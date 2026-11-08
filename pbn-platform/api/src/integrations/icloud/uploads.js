/**
 * Upload securizat din galeria clientului (iCloud Photos pe iPhone/iPad/Mac,
 * sau orice galerie locală), criptat în browser cu Web Crypto API.
 *
 *   1. issueUpload     (API)    — rând `pending_uploads` + URL PUT presigned + cheia publică RSA
 *   2. browserul               — AES-256-GCM pe fișier, RSA-OAEP pe cheia AES, PUT ciphertext în S3
 *   3. completeUpload  (API)    — primește cheia împachetată + IV + SHA-256, enqueue „icloud-finalize"
 *   4. finalizeUpload  (worker) — verifică mărimea, decriptează (KMS), verifică SHA-256 și formatul,
 *                                 salvează sursa, șterge ciphertext-ul
 *
 * Apple nu oferă un API web pentru biblioteca iCloud Photos; selectorul nativ
 * de fișiere al iOS/macOS este calea oficială de acces din browser.
 */
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { keys } from '../../storage/index.js';
import { decryptWebCryptoPayload } from '../../crypto/keys.js';
import { sha256Hex, sniffImage, storeSourceImage } from '../../ingest/sourceImages.js';

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
const GCM_TAG_BYTES = 16;
const UPLOAD_TTL_S = 300;

export class UploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function issueUpload({ db, storage, keyProvider, cfg }, { userId, plaintextBytes, mimeType }) {
  if (!ALLOWED_MIME.includes(mimeType)) throw new UploadError(`Unsupported type ${mimeType}`, 415);
  if (!Number.isInteger(plaintextBytes) || plaintextBytes <= 0 || plaintextBytes > cfg.MAX_UPLOAD_BYTES) {
    throw new UploadError(`File size must be 1..${cfg.MAX_UPLOAD_BYTES} bytes`, 413);
  }
  const id = randomUUID();
  const storageKey = keys.incoming(id);
  const ciphertextBytes = plaintextBytes + GCM_TAG_BYTES;
  const { keyId, spkiDer } = await keyProvider.getUploadPublicKey();
  const put = await storage.presignPut('sources', storageKey, {
    contentType: 'application/octet-stream', contentLength: ciphertextBytes, expiresIn: UPLOAD_TTL_S,
  });
  await db.query(
    `INSERT INTO pending_uploads (id, user_id, storage_key, ciphertext_bytes, key_id, mime_type, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7))`,
    [id, userId, storageKey, ciphertextBytes, keyId, mimeType, UPLOAD_TTL_S]);
  return {
    uploadId: id,
    upload: put, // { url, method, headers }
    ciphertextBytes,
    encryption: {
      algorithm: 'AES-256-GCM',
      keyWrap: 'RSA-OAEP-SHA-256',
      keyId,
      publicKeySpki: spkiDer.toString('base64'),
    },
    expiresInSeconds: UPLOAD_TTL_S,
  };
}

export async function completeUpload({ db, queues }, { userId, uploadId, wrappedKeyB64, ivB64, sha256, filename }) {
  if (!/^[a-f0-9]{64}$/.test(sha256 ?? '')) throw new UploadError('sha256 must be 64 hex chars');
  const iv = Buffer.from(ivB64 ?? '', 'base64');
  const wrappedKey = Buffer.from(wrappedKeyB64 ?? '', 'base64');
  if (iv.length !== 12) throw new UploadError('iv must be 12 bytes');
  if (wrappedKey.length < 256 || wrappedKey.length > 1024) throw new UploadError('invalid wrapped key');

  const { rowCount } = await db.query(
    `UPDATE pending_uploads
        SET status = 'uploaded', wrapped_key = $3, iv = $4, plaintext_sha256 = $5,
            original_filename = left($6, 255)
      WHERE id = $1 AND user_id = $2 AND status = 'issued' AND expires_at > now() - interval '1 hour'`,
    [uploadId, userId, wrappedKey, iv, sha256, filename ?? null]);
  if (!rowCount) throw new UploadError('Upload not found, expired or already completed', 404);
  await queues.ingest.add('icloud-finalize', { uploadId }, { jobId: `upload-${uploadId}` });
}

/** Rulează în worker-ul de ingestie (Node). Idempotent. */
export async function finalizeUpload({ db, storage, keyProvider }, uploadId) {
  const { rows } = await db.query('SELECT * FROM pending_uploads WHERE id = $1', [uploadId]);
  const up = rows[0];
  if (!up || up.status === 'ingested') return up?.source_image_id ?? null;
  if (up.status !== 'uploaded') throw new UploadError(`Unexpected upload status ${up.status}`);

  const fail = async (msg) => {
    await db.query(`UPDATE pending_uploads SET status = 'failed', error = $2 WHERE id = $1`, [uploadId, msg]);
    await storage.deleteObject('sources', up.storage_key).catch(() => {});
    throw Object.assign(new UploadError(msg), { permanent: true });
  };

  const head = await storage.headObject('sources', up.storage_key);
  if (!head) return fail('ciphertext not found in storage');
  if (head.size !== Number(up.ciphertext_bytes)) return fail(`size mismatch (${head.size} != ${up.ciphertext_bytes})`);

  let plaintext;
  try {
    const aesKey = await keyProvider.unwrapUploadKey(up.wrapped_key);
    plaintext = decryptWebCryptoPayload(aesKey, up.iv, await storage.getObject('sources', up.storage_key));
    aesKey.fill(0);
  } catch {
    return fail('decryption failed (wrong key, IV or tampered ciphertext)');
  }
  const actual = Buffer.from(sha256Hex(plaintext), 'hex');
  if (!timingSafeEqual(actual, Buffer.from(up.plaintext_sha256, 'hex'))) return fail('sha256 mismatch');
  if (!sniffImage(plaintext)) return fail('not a supported image');

  const src = await storeSourceImage({ db, storage }, {
    origin: 'icloud_upload', ownerUserId: up.user_id, bytes: plaintext, externalId: `upload:${uploadId}`,
  });
  await db.query(
    `UPDATE pending_uploads SET status = 'ingested', source_image_id = $2, wrapped_key = NULL WHERE id = $1`,
    [uploadId, src.id]);
  await storage.deleteObject('sources', up.storage_key);
  return src.id;
}

/**
 * Salvarea unei imagini sursă (stoc, Google Photos, upload iCloud/web):
 * verificare tip (după conținut, nu după extensie), hash SHA-256, upload în
 * bucket-ul de surse și înregistrare deduplicată în `source_images`.
 */
import { createHash } from 'node:crypto';
import { keys } from '../storage/index.js';

/** Detectează formatul după „magic bytes". Returnează null pentru orice altceva. */
export function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) {
      return { ext: 'heic', mime: 'image/heic' };
    }
  }
  return null;
}

export const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * @param {{ db: import('pg').Pool | import('pg').PoolClient, storage: any }} deps
 * @param {{ origin: string, ownerUserId?: string|null, bytes: Buffer, externalId?: string,
 *           author?: {name?: string, url?: string}, license?: string, attributionUrl?: string,
 *           width?: number, height?: number, hasPeople?: boolean|null, moderation?: string }} input
 * @returns {Promise<{ id: string, sha256: string, created: boolean }>}
 */
export async function storeSourceImage({ db, storage }, input) {
  const type = sniffImage(input.bytes);
  if (!type) throw Object.assign(new Error('Unsupported or invalid image format'), { code: 'bad_image' });
  const sha256 = sha256Hex(input.bytes);
  const owner = input.ownerUserId ?? null;
  const storageKey = owner ? keys.userSource(owner, sha256, type.ext) : keys.stockSource(sha256, type.ext);

  // Upload înaintea rândului din DB: un rând nu indică niciodată un obiect inexistent.
  // Cheia e derivată din hash, deci re-upload-ul aceluiași fișier e idempotent.
  await storage.putObject('sources', storageKey, input.bytes, type.mime);

  const { rows } = await db.query(
    `INSERT INTO source_images
       (origin, owner_user_id, external_id, author_name, author_url, license, attribution_url,
        storage_key, sha256, width_px, height_px, has_people, moderation)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (owner_user_id, sha256) DO UPDATE SET sha256 = EXCLUDED.sha256
     RETURNING id, (xmax = 0) AS created`,
    [input.origin, owner, input.externalId ?? null, input.author?.name ?? null, input.author?.url ?? null,
      input.license ?? null, input.attributionUrl ?? null, storageKey, sha256,
      input.width ?? null, input.height ?? null, input.hasPeople ?? null,
      input.moderation ?? (owner ? 'approved' : 'pending')],
  );
  return { id: rows[0].id, sha256, created: rows[0].created };
}

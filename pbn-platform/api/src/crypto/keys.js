/**
 * Furnizori de chei: criptarea token-urilor OAuth (envelope encryption) și
 * cheia RSA folosită de browser pentru a „împacheta" cheia AES a upload-urilor.
 *
 *  - LocalKeyProvider: doar dezvoltare/teste. Cheia master stă în env sau pe disc.
 *  - KmsKeyProvider:   producție. Cheile master NU părăsesc niciodată AWS KMS.
 *
 * Formatul unui blob criptat (envelope), versiunea 1:
 *   [1B versiune][2B lungime DEK împachetat][DEK împachetat][12B IV][16B tag][ciphertext]
 * DEK = data encryption key AES-256, unic per valoare criptată.
 */
import { createCipheriv, createDecipheriv, generateKeyPairSync, privateDecrypt,
  createPrivateKey, createPublicKey, randomBytes, constants } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const VERSION = 1;

function aesGcmEncrypt(key, plaintext, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ct };
}

function aesGcmDecrypt(key, iv, tag, ct, aad) {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function packEnvelope(wrappedDek, { iv, tag, ct }) {
  const header = Buffer.alloc(3);
  header.writeUInt8(VERSION, 0);
  header.writeUInt16BE(wrappedDek.length, 1);
  return Buffer.concat([header, wrappedDek, iv, tag, ct]);
}

function unpackEnvelope(blob) {
  if (blob.readUInt8(0) !== VERSION) throw new Error('Unsupported envelope version');
  const len = blob.readUInt16BE(1);
  let o = 3;
  const wrappedDek = blob.subarray(o, (o += len));
  const iv = blob.subarray(o, (o += 12));
  const tag = blob.subarray(o, (o += 16));
  return { wrappedDek, iv, tag, ct: blob.subarray(o) };
}

/**
 * Decriptează un fișier criptat de browser: AES-256-GCM, tag-ul de 16 octeți
 * la finalul ciphertext-ului (formatul nativ Web Crypto).
 */
export function decryptWebCryptoPayload(aesKey, iv, ciphertextWithTag) {
  if (aesKey.length !== 32) throw new Error('AES key must be 256-bit');
  if (iv.length !== 12) throw new Error('IV must be 96-bit');
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const ct = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
  return aesGcmDecrypt(aesKey, iv, tag, ct);
}

// ---------------------------------------------------------------------------
export class LocalKeyProvider {
  /**
   * @param {{ masterKeyB64?: string, uploadPrivateKeyPem?: string, keyDir?: string }} opts
   */
  constructor({ masterKeyB64, uploadPrivateKeyPem, keyDir = './.data/keys' } = {}) {
    this.keyId = 'local-dev';
    this.masterKey = masterKeyB64
      ? Buffer.from(masterKeyB64, 'base64')
      : this.#persisted(`${keyDir}/master.key`, () => randomBytes(32));
    if (this.masterKey.length !== 32) throw new Error('LOCAL_MASTER_KEY must be 32 bytes');

    // Cheia RSA trebuie să fie aceeași în API și în worker: o persistăm pe disc.
    const pem = uploadPrivateKeyPem
      ?? this.#persisted(`${keyDir}/upload-rsa.pem`, () =>
        Buffer.from(generateKeyPairSync('rsa', { modulusLength: 3072 })
          .privateKey.export({ type: 'pkcs8', format: 'pem' }))).toString();
    this.uploadPrivateKey = createPrivateKey(pem);
    this.uploadKeyId = 'local-rsa-3072';
  }

  #persisted(path, create) {
    if (existsSync(path)) return readFileSync(path);
    const value = create();
    mkdirSync(dirname(path), { recursive: true });
    try {
      // 'wx' = creare exclusivă: dacă API-ul și worker-ul pornesc simultan, doar unul
      // scrie cheia, iar celălalt o citește pe aceea (altfel ar folosi chei diferite).
      writeFileSync(path, value, { mode: 0o600, flag: 'wx' });
      return value;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      return readFileSync(path);
    }
  }

  async encrypt(plaintext, context) {
    const dek = randomBytes(32);
    const aad = Buffer.from(context);
    const w = aesGcmEncrypt(this.masterKey, dek, aad);
    const wrappedDek = Buffer.concat([w.iv, w.tag, w.ct]);
    return packEnvelope(wrappedDek, aesGcmEncrypt(dek, Buffer.from(plaintext), aad));
  }

  async decrypt(blob, context) {
    const { wrappedDek, iv, tag, ct } = unpackEnvelope(blob);
    const aad = Buffer.from(context);
    const dek = aesGcmDecrypt(this.masterKey, wrappedDek.subarray(0, 12),
      wrappedDek.subarray(12, 28), wrappedDek.subarray(28), aad);
    return aesGcmDecrypt(dek, iv, tag, ct, aad);
  }

  async getUploadPublicKey() {
    const spki = createPublicKey(this.uploadPrivateKey).export({ type: 'spki', format: 'der' });
    return { keyId: this.uploadKeyId, spkiDer: spki };
  }

  async unwrapUploadKey(wrappedKey) {
    return privateDecrypt(
      { key: this.uploadPrivateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      wrappedKey,
    );
  }
}

// ---------------------------------------------------------------------------
export class KmsKeyProvider {
  /**
   * @param {{ client: import('@aws-sdk/client-kms').KMSClient, tokenKeyId: string, uploadKeyId: string }} opts
   */
  constructor({ client, tokenKeyId, uploadKeyId }) {
    if (!tokenKeyId || !uploadKeyId) throw new Error('KMS key ids are required');
    this.client = client;
    this.keyId = tokenKeyId;
    this.uploadKeyId = uploadKeyId;
    this._publicKey = null;
  }

  async #kms() {
    return import('@aws-sdk/client-kms');
  }

  async encrypt(plaintext, context) {
    const { GenerateDataKeyCommand } = await this.#kms();
    // EncryptionContext leagă cheia de scopul ei (apare și în CloudTrail).
    const res = await this.client.send(new GenerateDataKeyCommand({
      KeyId: this.keyId, KeySpec: 'AES_256', EncryptionContext: { purpose: context },
    }));
    const dek = Buffer.from(res.Plaintext);
    try {
      return packEnvelope(Buffer.from(res.CiphertextBlob),
        aesGcmEncrypt(dek, Buffer.from(plaintext), Buffer.from(context)));
    } finally {
      dek.fill(0);
    }
  }

  async decrypt(blob, context) {
    const { DecryptCommand } = await this.#kms();
    const { wrappedDek, iv, tag, ct } = unpackEnvelope(blob);
    const res = await this.client.send(new DecryptCommand({
      CiphertextBlob: wrappedDek, KeyId: this.keyId, EncryptionContext: { purpose: context },
    }));
    const dek = Buffer.from(res.Plaintext);
    try {
      return aesGcmDecrypt(dek, iv, tag, ct, Buffer.from(context));
    } finally {
      dek.fill(0);
    }
  }

  async getUploadPublicKey() {
    if (!this._publicKey) {
      const { GetPublicKeyCommand } = await this.#kms();
      const res = await this.client.send(new GetPublicKeyCommand({ KeyId: this.uploadKeyId }));
      this._publicKey = { keyId: this.uploadKeyId, spkiDer: Buffer.from(res.PublicKey) };
    }
    return this._publicKey;
  }

  async unwrapUploadKey(wrappedKey) {
    const { DecryptCommand } = await this.#kms();
    const res = await this.client.send(new DecryptCommand({
      KeyId: this.uploadKeyId, CiphertextBlob: wrappedKey,
      EncryptionAlgorithm: 'RSAES_OAEP_SHA_256',
    }));
    return Buffer.from(res.Plaintext);
  }
}

export async function createKeyProvider(cfg) {
  if (cfg.KEY_PROVIDER === 'kms') {
    const { KMSClient } = await import('@aws-sdk/client-kms');
    return new KmsKeyProvider({
      client: new KMSClient({ region: cfg.S3_REGION }),
      tokenKeyId: cfg.KMS_TOKEN_KEY_ID,
      uploadKeyId: cfg.KMS_UPLOAD_KEY_ID,
    });
  }
  return new LocalKeyProvider({
    masterKeyB64: cfg.LOCAL_MASTER_KEY,
    uploadPrivateKeyPem: cfg.LOCAL_UPLOAD_PRIVATE_KEY_PEM,
  });
}

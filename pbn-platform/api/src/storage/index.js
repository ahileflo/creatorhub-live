/**
 * Stocarea obiectelor: o singură sursă de adevăr pentru organizarea cheilor
 * (vezi ARCHITECTURE.md §6) + două drivere cu aceeași interfață:
 *   - S3Storage   (producție; compatibil MinIO / GCS interoperability)
 *   - LocalStorage (dezvoltare și teste; URL-uri „presigned" semnate HMAC)
 *
 * Bucket-urile sunt logice: 'sources' | 'artifacts'. Driverul le mapează pe
 * numele reale din configurație.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

// ---------------------------------------------------------------------------
// Organizarea cheilor
// ---------------------------------------------------------------------------
const SAFE = /^[A-Za-z0-9._-]+$/;
function seg(value, name) {
  const v = String(value);
  if (!SAFE.test(v) || v === '.' || v === '..') throw new Error(`Invalid key segment ${name}=${v}`);
  return v;
}

export const keys = {
  stockSource: (sha256, ext) => `stock/${seg(sha256, 'sha256')}.${seg(ext, 'ext')}`,
  userSource: (userId, sha256, ext) =>
    `users/${seg(userId, 'userId')}/${seg(sha256, 'sha256')}.${seg(ext, 'ext')}`,
  incoming: (uploadId) => `incoming/${seg(uploadId, 'uploadId')}.bin`,
  orderJobPrefix: (orderId, jobId) => `orders/${seg(orderId, 'orderId')}/jobs/${seg(jobId, 'jobId')}/`,
  catalogPrefix: (designId, engineVersion, numColors, wMm, hMm) =>
    `catalog/${seg(designId, 'designId')}/${seg(engineVersion, 'engineVersion')}/` +
    `${Number(numColors)}c_${Number(wMm)}x${Number(hMm)}mm/`,
};

export const CONTENT_TYPES = {
  'canvas.svg': 'image/svg+xml',
  'solution.svg': 'image/svg+xml',
  'canvas.pdf': 'application/pdf',
  'recipe.json': 'application/json',
  'manifest.json': 'application/json',
  'painted.png': 'image/png',
  'numbered.png': 'image/png',
  'palette.png': 'image/png',
  'mockup.jpg': 'image/jpeg',
};

// ---------------------------------------------------------------------------
// Driver S3
// ---------------------------------------------------------------------------
export class S3Storage {
  constructor({ client, buckets }) {
    this.client = client;
    this.buckets = buckets; // { sources: '...', artifacts: '...' }
  }

  #b(bucket) {
    const name = this.buckets[bucket];
    if (!name) throw new Error(`Unknown bucket ${bucket}`);
    return name;
  }

  async putObject(bucket, key, body, contentType) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await this.client.send(new PutObjectCommand({
      Bucket: this.#b(bucket), Key: key, Body: body, ContentType: contentType,
    }));
  }

  async getObject(bucket, key) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.#b(bucket), Key: key }));
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async headObject(bucket, key) {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.#b(bucket), Key: key }));
      return { size: Number(res.ContentLength) };
    } catch (err) {
      if (err?.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }

  async deleteObject(bucket, key) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await this.client.send(new DeleteObjectCommand({ Bucket: this.#b(bucket), Key: key }));
  }

  /** URL PUT presigned; Content-Type și Content-Length sunt semnate (browserul nu le poate schimba). */
  async presignPut(bucket, key, { contentType, contentLength, expiresIn = 300 }) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const signed = new Set(['content-type', 'content-length']);
    const url = await getSignedUrl(this.client, new PutObjectCommand({
      Bucket: this.#b(bucket), Key: key, ContentType: contentType, ContentLength: contentLength,
    }), { expiresIn, signableHeaders: signed, unhoistableHeaders: signed });
    return { url, method: 'PUT', headers: { 'Content-Type': contentType } };
  }

  async presignGet(bucket, key, { expiresIn = 900, filename } = {}) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    return getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.#b(bucket), Key: key,
      ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
    }), { expiresIn });
  }
}

// ---------------------------------------------------------------------------
// Driver local (dezvoltare/teste)
// ---------------------------------------------------------------------------
export class LocalStorage {
  constructor({ rootDir, publicBaseUrl, secret }) {
    this.root = resolve(rootDir);
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
    this.secret = secret;
  }

  path(bucket, key) {
    if (!['sources', 'artifacts'].includes(bucket)) throw new Error(`Unknown bucket ${bucket}`);
    const p = resolve(join(this.root, bucket, key));
    if (!p.startsWith(this.root + sep)) throw new Error('Path traversal');
    return p;
  }

  async putObject(bucket, key, body) {
    const p = this.path(bucket, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  async getObject(bucket, key) {
    return readFile(this.path(bucket, key));
  }

  async headObject(bucket, key) {
    try {
      return { size: (await stat(this.path(bucket, key))).size };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async deleteObject(bucket, key) {
    await rm(this.path(bucket, key), { force: true });
  }

  sign(parts) {
    return createHmac('sha256', this.secret).update(parts.join('\n')).digest('hex');
  }

  #url(method, bucket, key, extra, expiresIn) {
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const sig = this.sign([method, bucket, key, exp, extra.len ?? '', extra.ct ?? '']);
    const q = new URLSearchParams({ exp: String(exp), sig });
    if (extra.len !== undefined) q.set('len', String(extra.len));
    if (extra.ct) q.set('ct', extra.ct);
    return `${this.publicBaseUrl}/_local-storage/${bucket}/${key}?${q}`;
  }

  async presignPut(bucket, key, { contentType, contentLength, expiresIn = 300 }) {
    return {
      url: this.#url('PUT', bucket, key, { len: contentLength, ct: contentType }, expiresIn),
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    };
  }

  async presignGet(bucket, key, { expiresIn = 900 } = {}) {
    return this.#url('GET', bucket, key, {}, expiresIn);
  }

  /** Verifică semnătura unui URL generat mai sus (folosit de ruta /_local-storage). */
  verify(method, bucket, key, query) {
    const exp = Number(query.exp);
    if (!exp || exp < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign([method, bucket, key, exp, query.len ?? '', query.ct ?? '']));
    const given = Buffer.from(String(query.sig ?? ''));
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}

export async function createStorage(cfg) {
  if (cfg.STORAGE_DRIVER === 's3') {
    const { S3Client } = await import('@aws-sdk/client-s3');
    return new S3Storage({
      client: new S3Client({
        region: cfg.S3_REGION,
        endpoint: cfg.S3_ENDPOINT,
        forcePathStyle: Boolean(cfg.S3_ENDPOINT),
      }),
      buckets: { sources: cfg.S3_BUCKET_SOURCES, artifacts: cfg.S3_BUCKET_ARTIFACTS },
    });
  }
  return new LocalStorage({
    rootDir: cfg.LOCAL_STORAGE_DIR, publicBaseUrl: cfg.PUBLIC_API_URL, secret: cfg.LOCAL_STORAGE_SECRET,
  });
}

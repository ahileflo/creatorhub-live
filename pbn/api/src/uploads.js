// MODUL 2b — iCloud Photos / galerie dispozitiv + stocare S3
//
// Realitate tehnică: Apple NU oferă un API web pentru biblioteca iCloud Photos a unui utilizator.
// CloudKit JS accesează doar containerele aplicației VOASTRE, nu pozele personale.
// Căile corecte, în ordinea preferinței:
//   1. Web (iPhone/iPad/Mac Safari): <input type="file" accept="image/*"> deschide nativ Photo Picker-ul
//      iOS, care include tot iCloud Photos (inclusiv pozele „optimizate” — iOS le descarcă la selecție).
//      Upload direct browser -> S3 prin URL pre-semnat (serverul nu atinge fișierul => scalează gratis).
//   2. Aplicație iOS nativă (mai târziu): PHPickerViewController — fără permisiune la toată galeria.
//   3. Android / Windows / alte cloud-uri (Dropbox, OneDrive): același input de fișier + pickere native.
//
// Securitate: TLS în tranzit + SSE-AES256 în repaus + chei pe ID de comandă + ștergere automată
// a originalului după 30 de zile (lifecycle rule pe prefixul orders/*/source/).
// Criptare end-to-end cu Web Crypto NU e folosită intenționat: workerul trebuie oricum să decripteze
// poza ca s-o proceseze, deci ar adăuga complexitate fără protecție reală. Vezi pbn/README.md.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']);
const MAX_BYTES = 40 * 1024 * 1024;
// tag folosit de lifecycle rule-ul din db/s3-lifecycle.json: originalele clienților se șterg după 30 zile
export const RETENTION_TAG = 'retention=customer-original';

export const s3 = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT_URL || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT_URL, // MinIO
});

export function sourceKey(orderId, ext) {
  const d = new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `orders/${d.getUTCFullYear()}/${mm}/${orderId}/source/original.${ext}`;
}

const extFor = (mime) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp' }[mime]);

/** URL pre-semnat pentru upload direct din browser (iCloud/galerie). Valabil 10 minute. */
export async function presignUpload(orderId, mimeType, size) {
  if (!ALLOWED.has(mimeType)) throw Object.assign(new Error('Format neacceptat'), { status: 415 });
  if (size > MAX_BYTES) throw Object.assign(new Error('Fișier prea mare (max 40MB)'), { status: 413 });
  const key = sourceKey(orderId, extFor(mimeType));
  const url = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: process.env.S3_BUCKET, Key: key, ContentType: mimeType, ContentLength: size,
    ServerSideEncryption: 'AES256', Tagging: RETENTION_TAG,
  }), { expiresIn: 600, unhoistableHeaders: new Set(['x-amz-tagging']) });
  return { key, url };
}

/** Upload server-side (folosit la importul din Google Photos). */
export async function putBuffer(orderId, buf, mimeType) {
  const key = sourceKey(orderId, extFor(mimeType) || 'jpg');
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET, Key: key, Body: buf, ContentType: mimeType, ServerSideEncryption: 'AES256',
    Tagging: RETENTION_TAG,
  }));
  return key;
}

/**
 * Upload criptat din browser (iCloud Photos / galerie locală) — Web Crypto API.
 * Fără dependențe; funcționează în Safari iOS 15+, Chrome, Firefox și Node 20+.
 *
 * Utilizare:
 *   <input type="file" accept="image/*" id="pick">
 *   // pe iPhone, selectorul nativ include biblioteca iCloud Photos
 *   const file = document.querySelector('#pick').files[0];
 *   const { uploadId } = await secureUpload(file, { apiBase: '/v1', token });
 *
 * Ce primește serverul: DOAR ciphertext + cheia AES împachetată cu RSA-OAEP.
 * Cheia privată RSA trăiește în KMS; nici API-ul, nici bucket-ul nu văd poza în clar
 * până la decriptarea din worker-ul de ingestie.
 *
 * Limită practică: fișierul e criptat integral în memorie (AES-GCM nu e streaming în
 * Web Crypto) — de aceea serverul plafonează mărimea (MAX_UPLOAD_BYTES, implicit 50 MB).
 */

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Normalizează tipul: Safari raportează uneori HEIC ca „" sau „image/heif". */
function mimeOf(file) {
  if (file.type) return file.type;
  const ext = (file.name ?? '').split('.').pop().toLowerCase();
  return { heic: 'image/heic', heif: 'image/heif', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[ext]
    ?? 'application/octet-stream';
}

/**
 * Criptează un ArrayBuffer pentru serverul nostru.
 * Exportată separat pentru teste și pentru reutilizare (ex. aplicație iOS cu WebView).
 */
export async function encryptForUpload(plaintext, publicKeySpkiB64, subtle = globalThis.crypto.subtle) {
  const rsaKey = await subtle.importKey('spki', fromB64(publicKeySpkiB64),
    { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['wrapKey']);
  const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const [ciphertext, wrappedKey, digest] = await Promise.all([
    subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext), // tag de 16 B la final
    subtle.wrapKey('raw', aesKey, rsaKey, { name: 'RSA-OAEP' }),
    subtle.digest('SHA-256', plaintext),
  ]);
  return { ciphertext, wrappedKeyB64: toB64(wrappedKey), ivB64: toB64(iv), sha256: toHex(digest) };
}

/**
 * Fluxul complet: cere URL-ul, criptează, urcă direct în S3, confirmă.
 * @param {File|Blob} file
 * @param {{ apiBase: string, token: string, fetch?: typeof fetch, onProgress?: (stage: string) => void }} opts
 */
export async function secureUpload(file, { apiBase, token, fetch: f = globalThis.fetch, onProgress = () => {} }) {
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const call = async (path, body) => {
    const res = await f(`${apiBase}${path}`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message ?? `${path} failed: ${res.status}`);
    return json;
  };

  onProgress('requesting');
  const ticket = await call('/uploads', { sizeBytes: file.size, mimeType: mimeOf(file) });

  onProgress('encrypting');
  const enc = await encryptForUpload(await file.arrayBuffer(), ticket.encryption.publicKeySpki);
  if (enc.ciphertext.byteLength !== ticket.ciphertextBytes) throw new Error('Unexpected ciphertext size');

  onProgress('uploading');
  const put = await f(ticket.upload.url, {
    method: ticket.upload.method, headers: ticket.upload.headers, body: enc.ciphertext,
  });
  if (!put.ok) throw new Error(`Storage upload failed: ${put.status}`);

  onProgress('finalizing');
  await call(`/uploads/${ticket.uploadId}/complete`, {
    wrappedKey: enc.wrappedKeyB64, iv: enc.ivB64, sha256: enc.sha256, filename: file.name ?? null,
  });
  onProgress('done');
  return { uploadId: ticket.uploadId };
}

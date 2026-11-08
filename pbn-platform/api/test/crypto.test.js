import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { LocalKeyProvider, decryptWebCryptoPayload } from '../src/crypto/keys.js';
import { encryptForUpload } from '../web/secure-upload.js';

const provider = new LocalKeyProvider({ keyDir: mkdtempSync(join(tmpdir(), 'pbn-keys-')) });

test('envelope encryption round-trips and is bound to its context', async () => {
  const blob = await provider.encrypt('1//refresh-token-secret', 'google-oauth-token:user-a');
  assert.ok(!blob.includes(Buffer.from('refresh-token-secret')), 'plaintext must not appear in blob');
  assert.equal((await provider.decrypt(blob, 'google-oauth-token:user-a')).toString(), '1//refresh-token-secret');
  // Un token copiat în rândul altui utilizator nu se poate decripta (AAD diferit).
  await assert.rejects(provider.decrypt(blob, 'google-oauth-token:user-b'));
});

test('envelope detects tampering', async () => {
  const blob = await provider.encrypt('secret', 'ctx');
  blob[blob.length - 1] ^= 0x01;
  await assert.rejects(provider.decrypt(blob, 'ctx'));
});

test('browser Web Crypto upload decrypts on the server (real RSA-OAEP + AES-GCM)', async () => {
  const plaintext = randomBytes(200_000);
  const { spkiDer } = await provider.getUploadPublicKey();
  const enc = await encryptForUpload(plaintext, spkiDer.toString('base64'));

  assert.equal(enc.ciphertext.byteLength, plaintext.length + 16, 'GCM tag appended');
  assert.equal(enc.sha256, createHash('sha256').update(plaintext).digest('hex'));

  const aesKey = await provider.unwrapUploadKey(Buffer.from(enc.wrappedKeyB64, 'base64'));
  const out = decryptWebCryptoPayload(aesKey, Buffer.from(enc.ivB64, 'base64'), Buffer.from(enc.ciphertext));
  assert.ok(out.equals(plaintext));
});

test('tampered upload ciphertext is rejected', async () => {
  const { spkiDer } = await provider.getUploadPublicKey();
  const enc = await encryptForUpload(Buffer.from('hello world, this is a photo'), spkiDer.toString('base64'));
  const ct = Buffer.from(enc.ciphertext);
  ct[0] ^= 0xff;
  const aesKey = await provider.unwrapUploadKey(Buffer.from(enc.wrappedKeyB64, 'base64'));
  assert.throws(() => decryptWebCryptoPayload(aesKey, Buffer.from(enc.ivB64, 'base64'), ct));
});

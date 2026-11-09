import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UnsplashSource, PexelsSource, looksLikePeople } from '../src/catalog/stockSources.js';
import { acceptCandidate, slugify } from '../src/catalog/ingest.js';
import { keys, LocalStorage } from '../src/storage/index.js';
import { sniffImage } from '../src/ingest/sourceImages.js';
import { idempotencyKey, stableStringify, buildEngineParams } from '../src/jobs/processingJobs.js';
import { fakeFetch } from './helpers.js';

test('unsplash results are normalised, tracked and filtered', async () => {
  const f = fakeFetch([
    { match: (u) => u.startsWith('https://api.unsplash.com/search/photos'), reply: () => ({ results: [
      { id: 'u1', width: 4000, height: 6000, alt_description: 'lavender field at sunset',
        urls: { raw: 'https://images.unsplash.com/photo-1?ixid=x' },
        links: { download_location: 'https://api.unsplash.com/photos/u1/download', html: 'https://unsplash.com/photos/u1' },
        user: { name: 'Ana', links: { html: 'https://unsplash.com/@ana' } } },
      { id: 'u2', width: 3000, height: 4500, alt_description: 'smiling woman in a hat',
        urls: { raw: 'https://images.unsplash.com/photo-2' }, links: {}, user: {} },
    ] }) },
    { match: (u) => u.includes('/download'), reply: () => ({ url: 'ok' }) },
    { match: (u) => u.startsWith('https://images.unsplash.com/photo-1'), reply: () => new Response(new Uint8Array(10)) },
  ]);
  const src = new UnsplashSource({ accessKey: 'k', fetch: f });
  const [a, b] = await src.search('lavender');
  assert.equal(f.calls[0].init.headers.Authorization, 'Client-ID k');
  assert.match(a.downloadUrl, /\?ixid=x&w=4000&fm=jpg&q=90$/);
  assert.equal(a.author.name, 'Ana');
  assert.equal(acceptCandidate(a), null);
  assert.equal(b.hasPeople, true);
  assert.match(acceptCandidate(b), /people/);

  await src.download(a);
  assert.ok(f.calls.some((c) => c.url === 'https://api.unsplash.com/photos/u1/download'), 'download tracking called');
});

test('pexels results are normalised', async () => {
  const f = fakeFetch([{ match: () => true, reply: () => ({ photos: [
    { id: 7, width: 1200, height: 1800, alt: 'Mountain lake', photographer: 'Ion',
      photographer_url: 'https://pexels.com/@ion', url: 'https://pexels.com/photo/7',
      src: { original: 'https://images.pexels.com/photos/7/p.jpeg' } }] }) }]);
  const [p] = await new PexelsSource({ apiKey: 'k', fetch: f }).search('lake');
  assert.equal(f.calls[0].init.headers.Authorization, 'k');
  assert.equal(p.externalId, '7');
  assert.match(acceptCandidate(p), /resolution/); // 1800 px < 2000 px
});

test('heuristics and slugs', () => {
  assert.equal(looksLikePeople('Family on the beach'), true);
  assert.equal(looksLikePeople('Manhattan skyline at night'), false); // „man" doar ca cuvânt întreg
  assert.equal(slugify('Câmp de lavandă — Provence!'), 'camp-de-lavanda-provence');
});

test('storage keys refuse path traversal', () => {
  assert.equal(keys.orderJobPrefix('o1', 'j1'), 'orders/o1/jobs/j1/');
  assert.equal(keys.catalogPrefix('d1', '0.1.0', 24, 400, 500), 'catalog/d1/0.1.0/24c_400x500mm/');
  assert.throws(() => keys.userSource('../etc', 'a'.repeat(64), 'jpg'));
  assert.throws(() => keys.incoming('a/b'));
});

test('local presigned URLs verify and expire', async () => {
  const s = new LocalStorage({ rootDir: mkdtempSync(join(tmpdir(), 'pbn-st-')), publicBaseUrl: 'http://x', secret: 's'.repeat(32) });
  const put = await s.presignPut('sources', 'incoming/a.bin', { contentType: 'application/octet-stream', contentLength: 5 });
  const u = new URL(put.url);
  const q = Object.fromEntries(u.searchParams);
  assert.equal(s.verify('PUT', 'sources', 'incoming/a.bin', q), true);
  assert.equal(s.verify('PUT', 'sources', 'incoming/b.bin', q), false);
  assert.equal(s.verify('PUT', 'sources', 'incoming/a.bin', { ...q, len: '6' }), false);
  assert.equal(s.verify('PUT', 'sources', 'incoming/a.bin', { ...q, exp: '1' }), false);
  assert.throws(() => s.path('sources', '../../etc/passwd'));
});

test('image sniffing uses magic bytes', () => {
  const jpg = readFileSync(new URL('./fixtures/sample.jpg', import.meta.url));
  assert.deepEqual(sniffImage(jpg), { ext: 'jpg', mime: 'image/jpeg' });
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
});

test('idempotency key is stable regardless of key order', () => {
  const p1 = buildEngineParams({ numColors: 24, canvasWmm: 400, canvasHmm: 500 });
  const p2 = { fit: 'crop', canvas_height_mm: 500, canvas_width_mm: 400, num_colors: 24 };
  assert.equal(stableStringify(p1), stableStringify(p2));
  const k = (params, scope = 'order:1') => idempotencyKey({ scope, sourceSha256: 'a', params, engineVersion: '0.1.0' });
  assert.equal(k(p1), k(p2));
  assert.notEqual(k(p1), k(p1, 'order:2'));
  assert.throws(() => buildEngineParams({ numColors: 25, canvasWmm: 400, canvasHmm: 500 }));
});

/**
 * Test de integrare end-to-end, pe infrastructură reală:
 *   PostgreSQL (schema din db/schema.sql) + Redis/BullMQ + stocare locală
 *   + worker-ul Python real (pbn_worker) care rulează pbn_engine.
 *
 * Google este simulat la nivel HTTP (fetch fals); tot restul e cod de producție.
 * Rulează doar dacă TEST_DATABASE_URL și TEST_REDIS_URL sunt setate:
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres \
 *   TEST_REDIS_URL=redis://127.0.0.1:6379 npm test
 * Partea cu Python rulează și ea, dacă PBN_E2E_PYTHON nu e „0".
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { SignJWT } from 'jose';
import { buildApp } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import { createVerifier } from '../src/auth.js';
import { LocalKeyProvider } from '../src/crypto/keys.js';
import { LocalStorage } from '../src/storage/index.js';
import { createQueues } from '../src/queue/index.js';
import { GoogleOAuth, PICKER_SCOPE } from '../src/integrations/google/oauth.js';
import { GooglePhotosPicker } from '../src/integrations/google/picker.js';
import { createProcessor } from '../src/workers/ingestWorker.js';
import { createProcessingJob, reapProcessingJobs } from '../src/jobs/processingJobs.js';
import { ingestTheme } from '../src/catalog/ingest.js';
import { withTx } from '../src/db.js';
import { encryptForUpload } from '../web/secure-upload.js';
import { fakeFetch, fakeRedis } from './helpers.js';

const DB_URL = process.env.TEST_DATABASE_URL;
const REDIS_URL = process.env.TEST_REDIS_URL;
const skip = !DB_URL || !REDIS_URL ? 'TEST_DATABASE_URL / TEST_REDIS_URL not set' : false;
const RUN_PY = process.env.PBN_E2E_PYTHON !== '0';

const here = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA = readFileSync(join(here, '../../db/schema.sql'), 'utf8');
const PHOTO = readFileSync(join(here, 'fixtures/sample.jpg'));
const SECRET = 'integration-test-secret-integration-test-secret';

let admin, dbName, app, deps, processIngest;
const premiumUser = randomUUID();
const freeUser = randomUUID();
const google = { mediaItemsSet: false };

const token = (sub) => new SignJWT({ email: `${sub}@test.dev` }).setProtectedHeader({ alg: 'HS256' })
  .setSubject(sub).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(SECRET));
const auth = async (sub) => ({ authorization: `Bearer ${await token(sub)}` });

before(async () => {
  if (skip) return;
  dbName = `pbn_test_${Date.now()}`;
  admin = new pg.Client({ connectionString: DB_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  const url = new URL(DB_URL);
  url.pathname = `/${dbName}`;
  const pool = new pg.Pool({ connectionString: url.toString() });
  await pool.query(SCHEMA);

  const storageDir = mkdtempSync(join(tmpdir(), 'pbn-it-storage-'));
  const cfg = loadConfig({
    NODE_ENV: 'test', DATABASE_URL: url.toString(), REDIS_URL, AUTH_JWT_SECRET: SECRET,
    QUEUE_PREFIX: `pbntest${Date.now()}`, LOCAL_STORAGE_DIR: storageDir, PUBLIC_API_URL: 'http://api.test',
    APP_URL: 'https://app.test',
  });

  // Google simulat la nivel HTTP.
  const googleFetch = fakeFetch([
    { match: (u) => u === 'https://oauth2.googleapis.com/token',
      reply: () => ({ access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, scope: `openid ${PICKER_SCOPE}` }) },
    { match: (u) => u.startsWith('https://openidconnect.googleapis.com'), reply: () => ({ sub: 'google-123' }) },
    { match: (u, i) => u.endsWith('/v1/sessions') && i.method === 'POST',
      reply: () => ({ id: 'sess-1', pickerUri: 'https://photos.google.com/picker/sess-1',
        pollingConfig: { pollInterval: '1s', timeoutIn: '600s' } }) },
    { match: (u, i) => u.includes('/v1/sessions/sess-1') && i.method === 'GET',
      reply: () => ({ id: 'sess-1', mediaItemsSet: google.mediaItemsSet, pollingConfig: { pollInterval: '1s' } }) },
    { match: (u, i) => u.includes('/v1/sessions/sess-1') && i.method === 'DELETE', reply: () => new Response(null, { status: 204 }) },
    { match: (u) => u.includes('/v1/mediaItems'),
      reply: () => ({ mediaItems: [{ id: 'gp-1', type: 'PHOTO',
        mediaFile: { baseUrl: 'https://lh3.googleusercontent.test/gp1', mimeType: 'image/jpeg',
          mediaFileMetadata: { width: 400, height: 500 } } }] }) },
    { match: (u) => u === 'https://lh3.googleusercontent.test/gp1=d',
      reply: () => new Response(PHOTO, { headers: { 'content-type': 'image/jpeg' } }) },
  ]);

  deps = {
    cfg,
    db: pool,
    storage: new LocalStorage({ rootDir: storageDir, publicBaseUrl: cfg.PUBLIC_API_URL, secret: cfg.LOCAL_STORAGE_SECRET }),
    keyProvider: new LocalKeyProvider({ keyDir: mkdtempSync(join(tmpdir(), 'pbn-it-keys-')) }),
    queues: createQueues({ redisUrl: REDIS_URL, prefix: cfg.QUEUE_PREFIX }),
    googleOAuth: new GoogleOAuth({ clientId: 'cid', clientSecret: 'cs', redirectUri: 'http://api.test/cb',
      redis: fakeRedis(), fetch: googleFetch }),
    picker: new GooglePhotosPicker({ fetch: googleFetch }),
    sources: [],
    verifyToken: createVerifier(cfg),
  };
  app = await buildApp(deps, { logger: false });
  const proc = createProcessor(deps);
  processIngest = (name, data) => proc({ name, data });

  // Creăm utilizatorii (primul request) și promovăm unul la premium.
  await app.inject({ method: 'GET', url: '/v1/integrations/google', headers: await auth(premiumUser) });
  await app.inject({ method: 'GET', url: '/v1/integrations/google', headers: await auth(freeUser) });
  await pool.query(`UPDATE users SET plan = 'premium' WHERE id = $1`, [premiumUser]);
});

after(async () => {
  if (skip) return;
  await app.close();
  for (const q of [deps.queues.orders, deps.queues.catalog, deps.queues.ingest]) await q.obliterate({ force: true });
  await deps.queues.close();
  await deps.db.end();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.end();
});

test('dev session issues a working token (non-production only)', { skip }, async () => {
  const r = await app.inject({ method: 'POST', url: '/v1/dev/session', payload: { email: 'Demo@Test.dev', plan: 'free' } });
  assert.equal(r.statusCode, 200, r.body);
  const { token, user } = r.json();
  const again = (await app.inject({ method: 'POST', url: '/v1/dev/session', payload: { email: 'demo@test.dev' } })).json();
  assert.equal(again.user.id, user.id, 'same e-mail → same user');
  const me = await app.inject({ method: 'GET', url: '/v1/orders', headers: { authorization: `Bearer ${token}` } });
  assert.equal(me.statusCode, 200);
});

test('auth: missing/invalid tokens are rejected; Module 2 requires premium', { skip }, async () => {
  assert.equal((await app.inject({ method: 'POST', url: '/v1/uploads' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/uploads',
    headers: { authorization: 'Bearer nope' } })).statusCode, 401);
  const r = await app.inject({ method: 'POST', url: '/v1/uploads', headers: await auth(freeUser),
    payload: { sizeBytes: 10, mimeType: 'image/jpeg' } });
  assert.equal(r.statusCode, 403);
  assert.equal(r.json().error, 'premium_required');
});

let uploadedSourceId;
test('iCloud/web: encrypted upload → presigned PUT → finalize → source image', { skip }, async () => {
  const headers = await auth(premiumUser);
  const issued = await app.inject({ method: 'POST', url: '/v1/uploads', headers,
    payload: { sizeBytes: PHOTO.length, mimeType: 'image/jpeg' } });
  assert.equal(issued.statusCode, 201, issued.body);
  const ticket = issued.json();

  // Exact ce face browserul (web/secure-upload.js).
  const enc = await encryptForUpload(PHOTO, ticket.encryption.publicKeySpki);
  const putUrl = new URL(ticket.upload.url);
  const put = await app.inject({ method: 'PUT', url: putUrl.pathname + putUrl.search,
    headers: ticket.upload.headers, payload: Buffer.from(enc.ciphertext) });
  assert.equal(put.statusCode, 200, put.body);

  // Semnătura protejează cheia: același URL nu poate scrie în alt obiect.
  const forged = await app.inject({ method: 'PUT', url: putUrl.pathname.replace('.bin', 'x.bin') + putUrl.search,
    headers: ticket.upload.headers, payload: Buffer.from(enc.ciphertext) });
  assert.equal(forged.statusCode, 403);

  const done = await app.inject({ method: 'POST', url: `/v1/uploads/${ticket.uploadId}/complete`, headers,
    payload: { wrappedKey: enc.wrappedKeyB64, iv: enc.ivB64, sha256: enc.sha256, filename: 'IMG_0001.JPG' } });
  assert.equal(done.statusCode, 202, done.body);
  const queued = await deps.queues.ingest.getJob(`upload-${ticket.uploadId}`);
  assert.ok(queued, 'finalize job queued');

  const { sourceImageId } = await processIngest('icloud-finalize', { uploadId: ticket.uploadId });
  const status = (await app.inject({ method: 'GET', url: `/v1/uploads/${ticket.uploadId}`, headers })).json();
  assert.equal(status.status, 'ingested');
  assert.equal(status.sourceImageId, sourceImageId);
  assert.equal(await deps.storage.headObject('sources', `incoming/${ticket.uploadId}.bin`), null, 'ciphertext deleted');
  const row = (await deps.db.query('SELECT storage_key, owner_user_id FROM source_images WHERE id = $1', [sourceImageId])).rows[0];
  assert.equal(row.owner_user_id, premiumUser);
  assert.ok((await deps.storage.getObject('sources', row.storage_key)).equals(PHOTO), 'decrypted bytes match the original');
  uploadedSourceId = sourceImageId;

  // Completarea repetată e refuzată (nu se poate înlocui cheia după upload).
  const again = await app.inject({ method: 'POST', url: `/v1/uploads/${ticket.uploadId}/complete`, headers,
    payload: { wrappedKey: enc.wrappedKeyB64, iv: enc.ivB64, sha256: enc.sha256 } });
  assert.equal(again.statusCode, 404);
});

test('iCloud/web: a wrong sha256 fails permanently and cleans up', { skip }, async () => {
  const headers = await auth(premiumUser);
  const ticket = (await app.inject({ method: 'POST', url: '/v1/uploads', headers,
    payload: { sizeBytes: PHOTO.length, mimeType: 'image/jpeg' } })).json();
  const enc = await encryptForUpload(PHOTO, ticket.encryption.publicKeySpki);
  const u = new URL(ticket.upload.url);
  await app.inject({ method: 'PUT', url: u.pathname + u.search, headers: ticket.upload.headers, payload: Buffer.from(enc.ciphertext) });
  await app.inject({ method: 'POST', url: `/v1/uploads/${ticket.uploadId}/complete`, headers,
    payload: { wrappedKey: enc.wrappedKeyB64, iv: enc.ivB64, sha256: 'f'.repeat(64) } });
  await assert.rejects(processIngest('icloud-finalize', { uploadId: ticket.uploadId }), { name: 'UnrecoverableError' });
  const s = (await app.inject({ method: 'GET', url: `/v1/uploads/${ticket.uploadId}`, headers })).json();
  assert.equal(s.status, 'failed');
  assert.match(s.error, /sha256/);
});

test('Google Photos: OAuth connect → picker session → polling → ingestion', { skip }, async () => {
  const headers = await auth(premiumUser);
  const c = await app.inject({ method: 'GET', url: '/v1/integrations/google/connect?returnTo=/create', headers });
  const state = new URL(c.json().authUrl).searchParams.get('state');

  const cb = await app.inject({ method: 'GET', url: `/v1/integrations/google/callback?code=abc&state=${state}` });
  assert.equal(cb.statusCode, 302);
  assert.equal(cb.headers.location, 'https://app.test/create?google=connected');
  const conn = (await deps.db.query(`SELECT refresh_token_enc FROM oauth_connections WHERE user_id = $1`, [premiumUser])).rows[0];
  assert.ok(!conn.refresh_token_enc.includes(Buffer.from('rt-1')), 'refresh token stored encrypted');

  // Callback re-jucat: `state` a fost consumat.
  const replay = await app.inject({ method: 'GET', url: `/v1/integrations/google/callback?code=abc&state=${state}` });
  assert.match(replay.headers.location, /google=invalid_state/);

  const ps = await app.inject({ method: 'POST', url: '/v1/integrations/google/picker-sessions', headers, payload: {} });
  assert.equal(ps.statusCode, 201, ps.body);
  assert.equal(ps.json().pickerUri, 'https://photos.google.com/picker/sess-1/autoclose');
  const first = await deps.queues.ingest.getJob('picker-sess-1-0');
  assert.ok(first && first.opts.delay === 1000, 'first poll scheduled with Google interval');

  // Utilizatorul nu a ales încă → se programează următorul poll.
  const r1 = await processIngest('google-picker-poll', first.data);
  assert.deepEqual(r1, { waiting: true });
  assert.ok(await deps.queues.ingest.getJob('picker-sess-1-1'));

  google.mediaItemsSet = true;
  const r2 = await processIngest('google-picker-poll', { ...first.data, attempt: 1 });
  assert.equal(r2.sourceImageIds.length, 1);
  const s = (await app.inject({ method: 'GET', url: '/v1/integrations/google/picker-sessions/sess-1', headers })).json();
  assert.equal(s.status, 'ingested');
  // Aceeași poză ca la upload-ul iCloud → dedup per utilizator (același rând).
  assert.equal(s.sourceImageIds[0], uploadedSourceId);
});

let orderJobId;
test('orders: custom order creates an idempotent, prioritised processing job', { skip }, async () => {
  const headers = await auth(premiumUser);
  const r = await app.inject({ method: 'POST', url: '/v1/orders', headers,
    payload: { sourceImageId: uploadedSourceId, numColors: 12, canvasWmm: 300, canvasHmm: 400 } });
  assert.equal(r.statusCode, 201, r.body);
  orderJobId = r.json().jobId;

  const bull = await deps.queues.orders.getJob(orderJobId);
  assert.deepEqual(bull.data, { jobId: orderJobId });
  assert.equal(bull.opts.priority, 1, 'premium priority');

  const row = (await deps.db.query('SELECT output_prefix, params, order_id FROM processing_jobs WHERE id = $1', [orderJobId])).rows[0];
  assert.equal(row.output_prefix, `orders/${row.order_id}/jobs/${orderJobId}/`);
  assert.deepEqual(row.params, { num_colors: 12, canvas_width_mm: 300, canvas_height_mm: 400, fit: 'crop' });

  // Același scope + parametri → același job (idempotență).
  const { sha256 } = (await deps.db.query('SELECT sha256 FROM source_images WHERE id = $1', [uploadedSourceId])).rows[0];
  const again = await withTx(deps.db, (tx) => createProcessingJob(tx, {
    kind: 'order', sourceImage: { id: uploadedSourceId, sha256 }, params: row.params,
    engineVersion: deps.cfg.ENGINE_VERSION, orderId: row.order_id, priority: 1 }));
  assert.equal(again.id, orderJobId);
  assert.equal(again.created, false);

  // Alt utilizator nu vede job-ul.
  const other = await app.inject({ method: 'GET', url: `/v1/jobs/${orderJobId}`, headers: await auth(freeUser) });
  assert.equal(other.statusCode, 404);
  // Nici nu poate comanda din poza altcuiva.
  const steal = await app.inject({ method: 'POST', url: '/v1/orders', headers: await auth(freeUser),
    payload: { sourceImageId: uploadedSourceId, numColors: 12, canvasWmm: 300, canvasHmm: 400 } });
  assert.equal(steal.statusCode, 404);
});

test('catalog: a theme is imported once and fans out into variant jobs', { skip }, async () => {
  const candidate = (id, extra = {}) => ({
    origin: 'unsplash', externalId: id, width: 3000, height: 4000, downloadUrl: `https://img.test/${id}`,
    description: 'lavender field', author: { name: 'Ana', url: 'https://unsplash.com/@ana' },
    attributionUrl: `https://unsplash.com/photos/${id}`, license: 'Unsplash License', hasPeople: false, ...extra,
  });
  const fakeSource = {
    origin: 'unsplash',
    search: async () => [candidate('c1'), candidate('c2', { hasPeople: true }), candidate('c3', { width: 800, height: 1000 })],
    download: async () => PHOTO,
  };
  const run = () => ingestTheme({ ...deps, sources: [fakeSource], log: {} },
    { theme: 'lavender field', category: 'flori', perSource: 5,
      variants: [{ numColors: 24, canvasWmm: 400, canvasHmm: 500 }, { numColors: 36, canvasWmm: 400, canvasHmm: 500 }] });

  const r1 = await run();
  assert.equal(r1.imported, 1);
  assert.equal(r1.jobs, 2);
  assert.equal(r1.skipped['identifiable people (needs model release)'], 1);
  assert.equal(r1.skipped['resolution too low'], 1);

  const jobs = (await deps.db.query(
    `SELECT j.id, j.output_prefix, d.num_colors FROM processing_jobs j
       JOIN catalog_designs d ON d.id = j.catalog_design_id ORDER BY d.num_colors`)).rows;
  assert.equal(jobs.length, 2);
  assert.match(jobs[0].output_prefix, /^catalog\/[0-9a-f-]+\/0\.1\.0\/24c_400x500mm\/$/);
  const bull = await deps.queues.catalog.getJob(jobs[0].id);
  assert.equal(bull.opts.priority, 10);
  const src = (await deps.db.query(`SELECT moderation, author_name, owner_user_id FROM source_images WHERE external_id = 'c1'`)).rows[0];
  assert.deepEqual(src, { moderation: 'pending', author_name: 'Ana', owner_user_id: null });

  const r2 = await run();
  assert.equal(r2.jobs, 0);
  assert.equal(r2.skipped['already imported'], 1);
});

test('reaper re-queues jobs whose worker died', { skip }, async () => {
  const { rows } = await deps.db.query(
    `UPDATE processing_jobs SET status = 'running', attempts = 1, heartbeat_at = now() - interval '10 minutes'
      WHERE kind = 'catalog' RETURNING id`);
  await deps.queues.catalog.obliterate({ force: true }); // simulăm și pierderea mesajelor din Redis
  const r = await reapProcessingJobs(deps.db, deps.queues, { queuedGraceSeconds: 0 });
  assert.equal(r.recovered, rows.length);
  assert.ok(r.requeued >= rows.length);
  for (const { id } of rows) assert.ok(await deps.queues.catalog.getJob(id), `job ${id} re-enqueued`);
  // Job-urile de catalog nu trebuie procesate de testul următor (worker-ul ascultă doar pbn-orders).
  await deps.db.query(`UPDATE processing_jobs SET status = 'cancelled' WHERE kind = 'catalog'`);
});

test('python worker consumes the BullMQ job and publishes production files', { skip: skip || !RUN_PY }, async () => {
  const procDir = join(here, '../../processing');
  const worker = spawn('python3', ['-m', 'pbn_worker'], {
    cwd: procDir,
    env: { ...process.env, DATABASE_URL: deps.cfg.DATABASE_URL, REDIS_URL, QUEUE_PREFIX: deps.cfg.QUEUE_PREFIX,
      LOCAL_STORAGE_DIR: deps.cfg.LOCAL_STORAGE_DIR, STORAGE_DRIVER: 'local', WORKER_QUEUES: 'pbn-orders',
      LOG_LEVEL: 'WARNING' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  try {
    let status;
    for (let i = 0; i < 120; i += 1) {
      status = (await deps.db.query('SELECT status FROM processing_jobs WHERE id = $1', [orderJobId])).rows[0].status;
      if (['succeeded', 'failed', 'dead'].includes(status)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(status, 'succeeded');

    const r = await app.inject({ method: 'GET', url: `/v1/jobs/${orderJobId}`, headers: await auth(premiumUser) });
    const job = r.json();
    const kinds = job.artifacts.map((a) => a.kind).sort();
    for (const k of ['canvas_svg', 'solution_svg', 'recipe_json', 'manifest_json', 'mockup_jpg', 'painted_png']) {
      assert.ok(kinds.includes(k), `artifact ${k}`);
    }
    assert.ok(job.stats.num_regions > 0);

    // Linkul presigned servește fișierul de print.
    const svg = job.artifacts.find((a) => a.kind === 'canvas_svg');
    const u = new URL(svg.url);
    const file = await app.inject({ method: 'GET', url: u.pathname + u.search });
    assert.equal(file.statusCode, 200);
    assert.match(file.body, /<svg[^>]+width="300mm"/);

    const recipe = (await deps.db.query('SELECT total_paint_ml, colors FROM paint_recipes WHERE job_id = $1', [orderJobId])).rows[0];
    assert.ok(Number(recipe.total_paint_ml) > 0 && recipe.colors.length >= 2);
    const order = (await deps.db.query(
      'SELECT o.status FROM orders o JOIN processing_jobs j ON j.order_id = o.id WHERE j.id = $1', [orderJobId])).rows[0];
    assert.equal(order.status, 'awaiting_approval');
    const src = (await deps.db.query('SELECT width_px, height_px FROM source_images WHERE id = $1', [uploadedSourceId])).rows[0];
    assert.deepEqual([src.width_px, src.height_px], [400, 500]);
    assert.ok(job.recipe && job.recipe.colors.length >= 2, 'job exposes the paint recipe');

    // Clientul aprobă varianta → comanda trece la plată; o a doua aprobare e refuzată.
    const headers = await auth(premiumUser);
    const list = (await app.inject({ method: 'GET', url: '/v1/orders', headers })).json();
    const mine = list.items.find((o) => o.job_id === orderJobId);
    assert.ok(mine, 'order listed for its owner');
    const ok = await app.inject({ method: 'POST', url: `/v1/orders/${mine.id}/approve`, headers, payload: { jobId: orderJobId } });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal(ok.json().status, 'awaiting_payment');
    const again = await app.inject({ method: 'POST', url: `/v1/orders/${mine.id}/approve`, headers, payload: { jobId: orderJobId } });
    assert.equal(again.statusCode, 409);
    const foreign = await app.inject({ method: 'GET', url: '/v1/orders', headers: await auth(freeUser) });
    assert.equal(foreign.json().items.length, 0, 'other users see none of it');
  } finally {
    worker.kill('SIGTERM');
    await new Promise((r) => worker.once('exit', r));
  }
});

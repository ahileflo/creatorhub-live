/**
 * Worker-ul de ingestie (Node.js, I/O-bound) — consumă coada `pbn-ingest`:
 *
 *   google-picker-poll  — verifică sesiunea Picker; când utilizatorul a ales pozele,
 *                         le descarcă (original), le salvează și închide sesiunea
 *   icloud-finalize     — decriptează și validează un upload Web Crypto
 *   catalog-ingest      — importă o temă din Unsplash/Pexels (Modulul 1)
 *   reap                — re-enqueue pentru job-uri de procesare pierdute/blocate
 *
 * Procesarea imaginilor (CPU) NU se face aici: o face worker-ul Python.
 */
import { UnrecoverableError, Worker } from 'bullmq';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config.js';
import { createDeps } from '../deps.js';
import { getAccessToken, GoogleOAuthError } from '../integrations/google/oauth.js';
import { PickerApiError } from '../integrations/google/picker.js';
import { finalizeUpload } from '../integrations/icloud/uploads.js';
import { storeSourceImage } from '../ingest/sourceImages.js';
import { ingestTheme } from '../catalog/ingest.js';
import { reapProcessingJobs } from '../jobs/processingJobs.js';
import { QUEUE_NAMES } from '../queue/index.js';

export async function pollPickerSession(deps, data) {
  const { db, keyProvider, googleOAuth, picker, queues, storage, cfg } = deps;
  const { sessionId, userId, startedAt, timeoutMs, attempt = 0 } = data;

  const { rows } = await db.query('SELECT status FROM picker_sessions WHERE id = $1 AND user_id = $2', [sessionId, userId]);
  if (!rows.length || rows[0].status !== 'pending') return { skipped: rows[0]?.status ?? 'missing' };

  const token = await getAccessToken(db, keyProvider, googleOAuth, userId);
  const session = await picker.getSession(token, sessionId);
  const setStatus = (status, extra = {}) => db.query(
    `UPDATE picker_sessions SET status = $2, source_image_ids = COALESCE($3, source_image_ids),
            error = $4, updated_at = now() WHERE id = $1`,
    [sessionId, status, extra.ids ?? null, extra.error ?? null]);

  if (!session.mediaItemsSet) {
    const expired = Date.now() - startedAt > timeoutMs || (session.expireTime && session.expireTime < new Date());
    if (expired) {
      await setStatus('expired');
      await picker.deleteSession(token, sessionId).catch(() => {});
      return { expired: true };
    }
    // Încă nu a ales: programăm următoarea verificare (intervalul dictat de Google).
    await queues.ingest.add('google-picker-poll', { ...data, attempt: attempt + 1 },
      { delay: session.pollIntervalMs, jobId: `picker-${sessionId}-${attempt + 1}`, attempts: 5 });
    return { waiting: true };
  }

  await setStatus('ingesting');
  const items = await picker.listMediaItems(token, sessionId);
  const photos = items.filter((i) => i.type === 'PHOTO' || i.mediaFile?.mimeType?.startsWith('image/'));
  const ids = [];
  for (const item of photos) {
    const { bytes } = await picker.downloadPhoto(token, item, { maxBytes: cfg.MAX_UPLOAD_BYTES });
    const meta = item.mediaFile?.mediaFileMetadata ?? {};
    const src = await storeSourceImage({ db, storage }, {
      origin: 'google_photos', ownerUserId: userId, bytes, externalId: item.id,
      width: meta.width ? Number(meta.width) : undefined, height: meta.height ? Number(meta.height) : undefined,
    });
    ids.push(src.id);
  }
  await setStatus(ids.length ? 'ingested' : 'failed', { ids, error: ids.length ? null : 'no photos selected' });
  await picker.deleteSession(token, sessionId).catch(() => {});
  return { sourceImageIds: ids };
}

export function createProcessor(deps) {
  return async (job) => {
    switch (job.name) {
      case 'google-picker-poll':
        try {
          return await pollPickerSession(deps, job.data);
        } catch (err) {
          // Conexiune revocată sau sesiune inexistentă la Google: reîncercarea nu ajută.
          const permanent = (err instanceof GoogleOAuthError && ['not_connected', 'invalid_grant'].includes(err.code))
            || (err instanceof PickerApiError && [400, 403, 404].includes(err.status));
          if (permanent) {
            await deps.db.query(
              `UPDATE picker_sessions SET status = 'failed', error = $2, updated_at = now()
                WHERE id = $1 AND status IN ('pending', 'ingesting')`,
              [job.data.sessionId, err.code ?? `google_${err.status}`]);
            throw new UnrecoverableError(err.message);
          }
          if (job.attemptsMade + 1 >= (job.opts?.attempts ?? 1)) {
            // Ultima încercare a eșuat: clientul vede eroarea în loc de „pending" la nesfârșit.
            await deps.db.query(
              `UPDATE picker_sessions SET status = 'failed', error = $2, updated_at = now()
                WHERE id = $1 AND status IN ('pending', 'ingesting')`,
              [job.data.sessionId, String(err.message).slice(0, 500)]);
          }
          throw err;
        }
      case 'icloud-finalize':
        try {
          return { sourceImageId: await finalizeUpload(deps, job.data.uploadId) };
        } catch (err) {
          // Erorile permanente (cheie greșită, hash diferit) nu se reîncearcă.
          if (err.permanent) throw new UnrecoverableError(err.message);
          throw err;
        }
      case 'catalog-ingest':
        return ingestTheme(deps, job.data);
      case 'reap':
        return reapProcessingJobs(deps.db, deps.queues);
      default:
        throw new Error(`Unknown ingest job ${job.name}`);
    }
  };
}

async function main() {
  const cfg = loadConfig();
  const deps = await createDeps(cfg);
  const worker = new Worker(QUEUE_NAMES.ingest, createProcessor(deps), {
    connection: { url: cfg.REDIS_URL }, prefix: cfg.QUEUE_PREFIX, concurrency: 8,
  });
  worker.on('failed', (job, err) => console.error(`[ingest] ${job?.name} ${job?.id} failed: ${err.message}`));

  // Reaper-ul rulează la fiecare minut; upsert => un singur scheduler indiferent câți workeri pornesc.
  await deps.queues.ingest.upsertJobScheduler('reaper', { every: 60_000 }, { name: 'reap', data: {} });
  // Catalog: teme din CATALOG_THEMES='[{"theme":"lavender field","category":"flori"}]', zilnic la 03:17 UTC.
  for (const t of JSON.parse(process.env.CATALOG_THEMES ?? '[]')) {
    await deps.queues.ingest.upsertJobScheduler(`catalog-${t.theme}`, { pattern: '17 3 * * *' },
      { name: 'catalog-ingest', data: { perSource: 10, ...t } });
  }

  const shutdown = async () => {
    await worker.close();
    await deps.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  console.log('[ingest] worker started');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

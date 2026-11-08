/**
 * Crearea job-urilor de procesare: rând în PostgreSQL (idempotent) + enqueue.
 *
 * Ordinea contează: rândul se scrie în tranzacția apelantului, iar enqueue-ul
 * se face DUPĂ commit (`enqueueProcessingJobs`). Dacă procesul moare între
 * cele două, job-ul rămâne 'queued' în DB și reaper-ul îl re-enqueue-ază.
 * BullMQ folosește `jobId` = ID-ul din DB, deci un enqueue dublu e ignorat.
 */
import { createHash, randomUUID } from 'node:crypto';
import { keys } from '../storage/index.js';
import { PRIORITY, QUEUE_NAMES } from '../queue/index.js';

export const SUPPORTED_COLOR_COUNTS = [12, 18, 24, 30, 36, 48, 60];

/** Stringify cu chei sortate: același obiect logic => același hash. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Doar parametrii pe care pbn_engine.ProcessingConfig îi acceptă de la API. */
export function buildEngineParams({ numColors, canvasWmm, canvasHmm, fit = 'crop' }) {
  if (!SUPPORTED_COLOR_COUNTS.includes(numColors)) throw new Error(`Unsupported numColors ${numColors}`);
  return { num_colors: numColors, canvas_width_mm: canvasWmm, canvas_height_mm: canvasHmm, fit };
}

export function idempotencyKey({ scope, sourceSha256, params, engineVersion }) {
  return createHash('sha256')
    .update(stableStringify({ scope, sourceSha256, params, engineVersion }))
    .digest('hex');
}

/**
 * @param {import('pg').PoolClient} client  — client în tranzacție
 * @returns {Promise<{ id: string, created: boolean, queue: string, priority: number }>}
 */
export async function createProcessingJob(client, {
  kind, sourceImage, params, engineVersion, orderId = null, catalogDesign = null, priority,
}) {
  const id = randomUUID();
  const scope = orderId ? `order:${orderId}` : `catalog:${catalogDesign.id}`;
  const outputPrefix = orderId
    ? keys.orderJobPrefix(orderId, id)
    : keys.catalogPrefix(catalogDesign.id, engineVersion, params.num_colors,
      params.canvas_width_mm, params.canvas_height_mm);
  const key = idempotencyKey({ scope, sourceSha256: sourceImage.sha256, params, engineVersion });

  const inserted = await client.query(
    `INSERT INTO processing_jobs
       (id, kind, priority, source_image_id, order_id, catalog_design_id, params,
        output_prefix, idempotency_key, engine_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [id, kind, priority, sourceImage.id, orderId, catalogDesign?.id ?? null, params,
      outputPrefix, key, engineVersion],
  );
  const queue = kind === 'catalog' ? QUEUE_NAMES.catalog : QUEUE_NAMES.orders;
  if (inserted.rowCount === 1) {
    await client.query(
      `INSERT INTO job_events (job_id, to_status, detail) VALUES ($1, 'queued', $2)`,
      [id, { queue }],
    );
    return { id, created: true, queue, priority };
  }
  const existing = await client.query(
    'SELECT id, priority FROM processing_jobs WHERE idempotency_key = $1', [key]);
  return { id: existing.rows[0].id, created: false, queue, priority: existing.rows[0].priority };
}

/** Enqueue după commit. `jobs` = rezultatele `createProcessingJob`. */
export async function enqueueProcessingJobs(queues, jobs) {
  await Promise.all(jobs.map((j) => {
    const q = j.queue === QUEUE_NAMES.catalog ? queues.catalog : queues.orders;
    return q.add('process', { jobId: j.id }, { jobId: j.id, priority: j.priority });
  }));
}

/**
 * Reaper: re-enqueue pentru job-uri rămase 'queued' (enqueue pierdut) și
 * marcarea celor blocate în 'running' (worker mort, heartbeat expirat).
 */
export async function reapProcessingJobs(pool, queues, { staleRunningMinutes = 5, queuedGraceSeconds = 60 } = {}) {
  const stale = await pool.query(
    `UPDATE processing_jobs
        SET status = CASE WHEN attempts >= max_attempts THEN 'dead'::job_status ELSE 'queued'::job_status END,
            worker_id = NULL
      WHERE status = 'running' AND heartbeat_at < now() - make_interval(mins => $1)
      RETURNING id, status`,
    [staleRunningMinutes],
  );
  const queued = await pool.query(
    `SELECT id, kind, priority FROM processing_jobs
      WHERE (status = 'queued' AND created_at < now() - make_interval(secs => $1))
         -- 'failed' cu încercări rămase: normal BullMQ îl reia; dacă Redis a pierdut
         -- job-ul, îl reluăm noi după ce backoff-ul maxim a expirat de mult.
         OR (status = 'failed' AND attempts < max_attempts AND finished_at < now() - interval '10 minutes')
      ORDER BY priority, created_at LIMIT 500`,
    [queuedGraceSeconds],
  );
  await enqueueProcessingJobs(queues, queued.rows.map((r) => ({
    id: r.id, priority: r.priority,
    queue: r.kind === 'catalog' ? QUEUE_NAMES.catalog : QUEUE_NAMES.orders,
  })));
  return { recovered: stale.rowCount, requeued: queued.rowCount };
}

export { PRIORITY };

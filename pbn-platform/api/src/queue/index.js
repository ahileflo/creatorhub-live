/**
 * Cozile BullMQ. Mesajele conțin DOAR identificatori ({ jobId }); parametrii
 * se citesc din PostgreSQL (sursa de adevăr), deci un mesaj duplicat, întârziat
 * sau re-enqueue-at de reaper nu poate produce o procesare cu date vechi.
 *
 *   pbn-orders   → worker Python (CPU), comenzi; premium = prioritate 1
 *   pbn-catalog  → worker Python (CPU), generare catalog; prioritate 10
 *   pbn-ingest   → worker Node (I/O): poll Google Picker, decriptare upload, stoc
 */
import { Queue } from 'bullmq';

export const QUEUE_NAMES = Object.freeze({
  orders: 'pbn-orders',
  catalog: 'pbn-catalog',
  ingest: 'pbn-ingest',
});

export const PRIORITY = Object.freeze({ premium: 1, standard: 5, catalog: 10 });

/** Opțiuni implicite: 3 încercări, backoff exponențial 10s → 20s → 40s. */
export const DEFAULT_JOB_OPTS = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { age: 24 * 3600, count: 10_000 },
  removeOnFail: { age: 14 * 24 * 3600 }, // job-urile eșuate rămân 14 zile (debugging / DLQ)
});

export function createQueues({ redisUrl, prefix }) {
  const connection = { url: redisUrl };
  const make = (name) => new Queue(name, { connection, prefix, defaultJobOptions: DEFAULT_JOB_OPTS });
  const queues = {
    orders: make(QUEUE_NAMES.orders),
    catalog: make(QUEUE_NAMES.catalog),
    ingest: make(QUEUE_NAMES.ingest),
  };
  queues.close = () => Promise.all([queues.orders, queues.catalog, queues.ingest].map((q) => q.close()));
  return queues;
}

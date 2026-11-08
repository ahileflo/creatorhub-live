// Coada de procesare: Redis LIST `pbn:jobs` (contract consumat de pbn/engine/worker.py).
// Starea autoritară a fiecărui job e în Postgres (processing_jobs) — Redis e doar transport.
// Pentru sute de modele simultan: rulați N workeri Python; BRPOP distribuie joburile.
// Alternativă gestionată: AWS SQS (aceeași formă de mesaj) dacă nu vreți să operați Redis.

import Redis from 'ioredis';
import { pool } from './db.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
export const QUEUE = 'pbn:jobs';

export async function enqueueJob({ orderId, sourceKey, nColors = 24, widthCm = 40, heightCm = 50, priority = 0 }) {
  const { rows } = await pool.query(
    `INSERT INTO processing_jobs (order_id, source_key, n_colors, width_cm, height_cm, priority)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [orderId, sourceKey, nColors, widthCm, heightCm, priority],
  );
  const job = { job_id: rows[0].id, order_id: orderId, source_key: sourceKey, n_colors: nColors, width_cm: widthCm, height_cm: heightCm };
  // Premium => RPUSH (consumat primul de BRPOP), standard => LPUSH (la coadă)
  if (priority > 0) await redis.rpush(QUEUE, JSON.stringify(job));
  else await redis.lpush(QUEUE, JSON.stringify(job));
  return rows[0].id;
}

export async function queueDepth() {
  return redis.llen(QUEUE);
}

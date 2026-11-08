/** Comenzi, job-uri de procesare și catalogul public. */
import { z } from 'zod';
import { withTx } from '../db.js';
import { buildEngineParams, createProcessingJob, enqueueProcessingJobs, PRIORITY,
  SUPPORTED_COLOR_COUNTS } from '../jobs/processingJobs.js';

const orderBody = z.object({
  sourceImageId: z.uuid().optional(),
  catalogDesignId: z.uuid().optional(),
  numColors: z.number().int().refine((n) => SUPPORTED_COLOR_COUNTS.includes(n)).optional(),
  canvasWmm: z.number().int().min(200).max(1000).optional(),
  canvasHmm: z.number().int().min(200).max(1000).optional(),
  fit: z.enum(['crop', 'pad']).default('crop'),
}).refine((b) => Boolean(b.sourceImageId) !== Boolean(b.catalogDesignId),
  { message: 'Exactly one of sourceImageId or catalogDesignId is required' });

export default async function orderRoutes(app, { deps, requireUser }) {
  const { db, queues, storage, cfg } = deps;
  const auth = { preHandler: [requireUser] };

  app.post('/v1/orders', auth, async (req, reply) => {
    const b = orderBody.parse(req.body);

    // Comandă din catalog: fișierele de producție există deja (job-ul de catalog).
    if (b.catalogDesignId) {
      const { rows } = await db.query(
        `SELECT d.id, d.num_colors, d.canvas_w_mm, d.canvas_h_mm, d.source_image_id,
                (SELECT j.id FROM processing_jobs j WHERE j.catalog_design_id = d.id AND j.status = 'succeeded'
                  ORDER BY j.finished_at DESC LIMIT 1) AS job_id
           FROM catalog_designs d WHERE d.id = $1 AND d.published_at IS NOT NULL`, [b.catalogDesignId]);
      if (!rows.length || !rows[0].job_id) return reply.code(404).send({ error: 'not_found' });
      const d = rows[0];
      const order = await db.query(
        `INSERT INTO orders (user_id, status, catalog_design_id, num_colors, canvas_w_mm, canvas_h_mm, approved_job_id)
         VALUES ($1, 'draft', $2, $3, $4, $5, $6) RETURNING id, status`,
        [req.user.id, d.id, d.num_colors, d.canvas_w_mm, d.canvas_h_mm, d.job_id]);
      return reply.code(201).send({ orderId: order.rows[0].id, status: order.rows[0].status, jobId: d.job_id });
    }

    // Comandă personalizată: poza clientului (Google Photos / iCloud / upload).
    if (!b.numColors || !b.canvasWmm || !b.canvasHmm) {
      return reply.code(400).send({ error: 'validation', message: 'numColors, canvasWmm, canvasHmm are required' });
    }
    const src = await db.query(
      'SELECT id, sha256 FROM source_images WHERE id = $1 AND owner_user_id = $2', [b.sourceImageId, req.user.id]);
    if (!src.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Source image not found' });

    const params = buildEngineParams(b);
    const result = await withTx(db, async (tx) => {
      const order = await tx.query(
        `INSERT INTO orders (user_id, status, source_image_id, num_colors, canvas_w_mm, canvas_h_mm, fit_mode)
         VALUES ($1, 'awaiting_processing', $2, $3, $4, $5, $6) RETURNING id`,
        [req.user.id, src.rows[0].id, b.numColors, b.canvasWmm, b.canvasHmm, b.fit]);
      const job = await createProcessingJob(tx, {
        kind: 'order', sourceImage: src.rows[0], params, engineVersion: cfg.ENGINE_VERSION,
        orderId: order.rows[0].id,
        priority: req.user.plan === 'premium' ? PRIORITY.premium : PRIORITY.standard,
      });
      return { orderId: order.rows[0].id, job };
    });
    await enqueueProcessingJobs(queues, [result.job]);
    return reply.code(201).send({ orderId: result.orderId, status: 'awaiting_processing', jobId: result.job.id });
  });

  app.get('/v1/orders/:id', auth, async (req, reply) => {
    const { rows } = await db.query(
      `SELECT o.id, o.status, o.num_colors, o.canvas_w_mm, o.canvas_h_mm, o.approved_job_id, o.created_at,
              (SELECT json_agg(json_build_object('jobId', j.id, 'status', j.status) ORDER BY j.created_at)
                 FROM processing_jobs j WHERE j.order_id = o.id) AS jobs
         FROM orders o WHERE o.id = $1 AND o.user_id = $2`, [req.params.id, req.user.id]);
    if (!rows.length) return reply.code(404).send({ error: 'not_found' });
    return rows[0];
  });

  // Starea unui job + linkuri temporare către fișiere (doar pentru proprietarul comenzii).
  app.get('/v1/jobs/:id', auth, async (req, reply) => {
    const { rows } = await db.query(
      `SELECT j.id, j.status, j.stats, j.error, j.attempts, j.created_at, j.finished_at
         FROM processing_jobs j
         LEFT JOIN orders o ON o.id = j.order_id
        WHERE j.id = $1 AND (o.user_id = $2 OR j.id IN (
              SELECT approved_job_id FROM orders WHERE user_id = $2 AND approved_job_id IS NOT NULL))`,
      [req.params.id, req.user.id]);
    if (!rows.length) return reply.code(404).send({ error: 'not_found' });
    const job = rows[0];
    let artifacts = [];
    if (job.status === 'succeeded') {
      const a = await db.query(
        'SELECT kind, storage_key, content_type, bytes FROM job_artifacts WHERE job_id = $1 ORDER BY kind', [job.id]);
      artifacts = await Promise.all(a.rows.map(async (r) => ({
        kind: r.kind, contentType: r.content_type, bytes: Number(r.bytes),
        url: await storage.presignGet('artifacts', r.storage_key, {
          expiresIn: 900, filename: r.storage_key.split('/').pop(),
        }),
      })));
    }
    return { ...job, artifacts };
  });

  app.get('/v1/catalog', async (req) => {
    const q = z.object({
      category: z.string().max(60).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(24),
    }).parse(req.query ?? {});
    const { rows } = await db.query(
      `SELECT d.id, d.slug, d.title, d.category, d.tags, d.num_colors, d.canvas_w_mm, d.canvas_h_mm,
              d.difficulty, d.num_regions, d.total_paint_ml, s.author_name, s.attribution_url, s.license
         FROM catalog_designs d JOIN source_images s ON s.id = d.source_image_id
        WHERE d.published_at IS NOT NULL AND ($1::text IS NULL OR d.category = $1)
        ORDER BY d.published_at DESC LIMIT $2`, [q.category ?? null, q.limit]);
    return { items: rows };
  });
}

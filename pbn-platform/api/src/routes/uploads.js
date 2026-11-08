/** Upload criptat (iCloud Photos / galerie locală) — Modulul 2, Premium. */
import { z } from 'zod';
import { completeUpload, issueUpload } from '../integrations/icloud/uploads.js';

const issueBody = z.object({
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().max(100),
});
const completeBody = z.object({
  wrappedKey: z.string().max(2048),
  iv: z.string().max(64),
  sha256: z.string().length(64),
  filename: z.string().max(255).nullish(),
});

export default async function uploadRoutes(app, { deps, requireUser, requirePremium }) {
  const guarded = { preHandler: [requireUser, requirePremium] };

  app.post('/v1/uploads', guarded, async (req, reply) => {
    const body = issueBody.parse(req.body);
    const ticket = await issueUpload(deps, { userId: req.user.id, plaintextBytes: body.sizeBytes, mimeType: body.mimeType });
    return reply.code(201).send(ticket);
  });

  app.post('/v1/uploads/:id/complete', guarded, async (req, reply) => {
    const body = completeBody.parse(req.body);
    await completeUpload(deps, {
      userId: req.user.id, uploadId: req.params.id,
      wrappedKeyB64: body.wrappedKey, ivB64: body.iv, sha256: body.sha256, filename: body.filename,
    });
    return reply.code(202).send({ uploadId: req.params.id, status: 'uploaded' });
  });

  app.get('/v1/uploads/:id', { preHandler: [requireUser] }, async (req, reply) => {
    const { rows } = await deps.db.query(
      `SELECT id, status, source_image_id, error, created_at FROM pending_uploads
        WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (!rows.length) return reply.code(404).send({ error: 'not_found' });
    const u = rows[0];
    return { uploadId: u.id, status: u.status, sourceImageId: u.source_image_id, error: u.error };
  });
}

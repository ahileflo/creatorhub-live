/** Rutele Google Photos (Modulul 2, Premium). */
import { z } from 'zod';
import { disconnect, getAccessToken, saveConnection } from '../integrations/google/oauth.js';

/** Acceptăm doar căi relative („/comenzi/noua"), nu URL-uri externe (open redirect). */
export function safeReturnPath(value) {
  return typeof value === 'string' && /^\/(?![/\\])[^\s]*$/.test(value) ? value : '/';
}

export default async function googleRoutes(app, { deps, requireUser, requirePremium }) {
  const { db, cfg, keyProvider, googleOAuth, picker, queues } = deps;
  const guarded = { preHandler: [requireUser, requirePremium] };

  app.get('/v1/integrations/google/connect', guarded, async (req) => {
    const returnTo = safeReturnPath(req.query?.returnTo);
    const { url } = await googleOAuth.createAuthorizationUrl({ userId: req.user.id, returnTo });
    return { authUrl: url };
  });

  // Redirect de la Google: nu are header Authorization; utilizatorul vine din `state`.
  app.get('/v1/integrations/google/callback', async (req, reply) => {
    const { code, state, error } = req.query ?? {};
    const saved = await googleOAuth.consumeState(state);
    const back = (path, status) => {
      const url = new URL(path, cfg.APP_URL);
      url.searchParams.set('google', status);
      return reply.redirect(url.toString(), 302);
    };
    if (!saved) return back('/', 'invalid_state');
    if (error || !code) return back(saved.returnTo, 'denied');
    try {
      const tokens = await googleOAuth.exchangeCode({ code, codeVerifier: saved.codeVerifier });
      const accountId = await googleOAuth.fetchAccountId(tokens.accessToken);
      await saveConnection(db, keyProvider, { userId: saved.userId, accountId, tokens });
      return back(saved.returnTo, 'connected');
    } catch (err) {
      req.log.warn({ err: err.message, code: err.code }, 'google oauth callback failed');
      return back(saved.returnTo, err.code === 'scope_denied' ? 'scope_denied' : 'error');
    }
  });

  app.get('/v1/integrations/google', { preHandler: [requireUser] }, async (req) => {
    const { rows } = await db.query(
      `SELECT scopes, created_at, updated_at FROM oauth_connections
        WHERE user_id = $1 AND provider = 'google' AND revoked_at IS NULL`, [req.user.id]);
    return { connected: rows.length > 0, ...(rows[0] ? { scopes: rows[0].scopes, since: rows[0].created_at } : {}) };
  });

  app.delete('/v1/integrations/google', { preHandler: [requireUser] }, async (req, reply) => {
    await disconnect(db, keyProvider, googleOAuth, req.user.id);
    return reply.code(204).send();
  });

  // Pornește o sesiune Picker: clientul deschide `pickerUri`, serverul face polling.
  app.post('/v1/integrations/google/picker-sessions', guarded, async (req, reply) => {
    const { maxItems } = z.object({ maxItems: z.number().int().min(1).max(20).default(5) })
      .parse(req.body ?? {});
    const accessToken = await getAccessToken(db, keyProvider, googleOAuth, req.user.id);
    const session = await picker.createSession(accessToken, { maxItemCount: maxItems });
    await db.query(
      `INSERT INTO picker_sessions (id, user_id, expire_time) VALUES ($1, $2, $3)`,
      [session.id, req.user.id, session.expireTime]);
    await queues.ingest.add('google-picker-poll',
      { sessionId: session.id, userId: req.user.id, startedAt: Date.now(), timeoutMs: session.timeoutMs },
      { delay: session.pollIntervalMs, jobId: `picker-${session.id}-0`, attempts: 5 });
    return reply.code(201).send({
      sessionId: session.id,
      // „/autoclose" închide fereastra Google după selecție (UX mai bun pe mobil).
      pickerUri: `${session.pickerUri.replace(/\/$/, '')}/autoclose`,
      expireTime: session.expireTime,
    });
  });

  app.get('/v1/integrations/google/picker-sessions/:id', { preHandler: [requireUser] }, async (req, reply) => {
    const { rows } = await db.query(
      `SELECT id, status, source_image_ids, error, expire_time, updated_at FROM picker_sessions
        WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (!rows.length) return reply.code(404).send({ error: 'not_found' });
    const s = rows[0];
    return { sessionId: s.id, status: s.status, sourceImageIds: s.source_image_ids, error: s.error, expireTime: s.expire_time };
  });
}

/**
 * API HTTP (Fastify 5). `buildApp(deps)` primește dependențele gata construite,
 * deci testele pot rula aplicația completă cu `app.inject()` fără port deschis.
 */
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { createDeps } from './deps.js';
import { authPlugin, createVerifier } from './auth.js';
import { GoogleOAuthError } from './integrations/google/oauth.js';
import { PickerApiError } from './integrations/google/picker.js';
import { UploadError } from './integrations/icloud/uploads.js';
import { LocalStorage } from './storage/index.js';
import googleRoutes from './routes/google.js';
import uploadRoutes from './routes/uploads.js';
import orderRoutes from './routes/orders.js';

export async function buildApp(deps, { logger = true } = {}) {
  const app = Fastify({ logger, trustProxy: deps.cfg.TRUST_PROXY, bodyLimit: 256 * 1024 });
  const { requireUser, requirePremium } = authPlugin(app, {
    db: deps.db, verify: deps.verifyToken ?? createVerifier(deps.cfg),
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'validation', message: 'Invalid request', issues: err.issues });
    }
    if (err instanceof UploadError) return reply.code(err.status).send({ error: 'upload', message: err.message });
    if (err instanceof GoogleOAuthError && ['not_connected', 'invalid_grant'].includes(err.code)) {
      return reply.code(409).send({ error: 'google_reconnect_required', message: err.message });
    }
    if (err instanceof PickerApiError) {
      req.log.warn({ status: err.status }, 'picker api error');
      return reply.code(502).send({ error: 'google_unavailable', message: 'Google Photos request failed' });
    }
    if (err.validation || err.statusCode === 400) return reply.code(400).send({ error: 'bad_request', message: err.message });
    req.log.error(err);
    return reply.code(500).send({ error: 'internal', message: 'Internal error' });
  });

  app.get('/health', async () => {
    await deps.db.query('SELECT 1');
    return { ok: true };
  });

  const opts = { deps, requireUser, requirePremium };
  await app.register(googleRoutes, opts);
  await app.register(uploadRoutes, opts);
  await app.register(orderRoutes, opts);

  // Emulator de S3 presigned pentru dezvoltare (doar driverul local).
  if (deps.storage instanceof LocalStorage) {
    await app.register(async (scope) => {
      scope.addContentTypeParser('application/octet-stream',
        { parseAs: 'buffer', bodyLimit: deps.cfg.MAX_UPLOAD_BYTES + 64 }, (_req, body, done) => done(null, body));
      scope.put('/_local-storage/:bucket/*', async (req, reply) => {
        const { bucket } = req.params;
        const key = req.params['*'];
        if (!deps.storage.verify('PUT', bucket, key, req.query)) return reply.code(403).send({ error: 'bad_signature' });
        if (req.headers['content-type'] !== req.query.ct) return reply.code(403).send({ error: 'content_type_mismatch' });
        if (req.body.length !== Number(req.query.len)) return reply.code(403).send({ error: 'length_mismatch' });
        await deps.storage.putObject(bucket, key, req.body);
        return reply.code(200).send();
      });
      scope.get('/_local-storage/:bucket/*', async (req, reply) => {
        const { bucket } = req.params;
        const key = req.params['*'];
        if (!deps.storage.verify('GET', bucket, key, req.query)) return reply.code(403).send({ error: 'bad_signature' });
        const body = await deps.storage.getObject(bucket, key).catch(() => null);
        if (!body) return reply.code(404).send();
        return reply.type('application/octet-stream').send(body);
      });
    });
  }
  return app;
}

async function main() {
  const cfg = loadConfig();
  const deps = await createDeps(cfg);
  const app = await buildApp(deps);
  const shutdown = async () => {
    await app.close();
    await deps.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  await app.listen({ port: cfg.PORT, host: '0.0.0.0' });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

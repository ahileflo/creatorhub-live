/**
 * Autentificare: verificăm un JWT emis de furnizorul de identitate
 * (Cognito / Auth0 / Clerk prin JWKS în producție, HS256 în dezvoltare).
 * `sub` trebuie să fie UUID-ul utilizatorului. Planul (free/premium) se citește
 * din baza noastră de date — niciodată din token, pe care nu îl controlăm.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createVerifier(cfg) {
  const opts = { issuer: cfg.AUTH_ISSUER, audience: cfg.AUTH_AUDIENCE };
  if (cfg.AUTH_JWKS_URL) {
    const jwks = createRemoteJWKSet(new URL(cfg.AUTH_JWKS_URL));
    return async (token) => (await jwtVerify(token, jwks, opts)).payload;
  }
  if (!cfg.AUTH_JWT_SECRET) throw new Error('AUTH_JWT_SECRET or AUTH_JWKS_URL must be set');
  const secret = new TextEncoder().encode(cfg.AUTH_JWT_SECRET);
  return async (token) => (await jwtVerify(token, secret, { ...opts, algorithms: ['HS256'] })).payload;
}

export function authPlugin(app, { db, verify }) {
  app.decorateRequest('user', null);

  /** preHandler: cere un utilizator autentificat. */
  const requireUser = async (request, reply) => {
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return reply.code(401).send({ error: 'unauthorized', message: 'Missing bearer token' });
    let claims;
    try {
      claims = await verify(token);
    } catch {
      return reply.code(401).send({ error: 'unauthorized', message: 'Invalid token' });
    }
    if (!UUID.test(claims.sub ?? '')) return reply.code(401).send({ error: 'unauthorized', message: 'Invalid subject' });

    // Prima cerere a unui utilizator nou îl creează (plan free).
    await db.query(
      `INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [claims.sub, claims.email ?? `${claims.sub}@users.invalid`]);
    const { rows } = await db.query('SELECT id, email, plan FROM users WHERE id = $1', [claims.sub]);
    request.user = rows[0];
  };

  /** preHandler: Modulul 2 (Google Photos / iCloud) e disponibil doar pe planul premium. */
  const requirePremium = async (request, reply) => {
    if (request.user?.plan !== 'premium') {
      return reply.code(403).send({ error: 'premium_required', message: 'This feature requires a Premium plan' });
    }
  };

  return { requireUser, requirePremium };
}

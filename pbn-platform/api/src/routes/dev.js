/**
 * Autentificare de DEZVOLTARE: emite un JWT HS256 pentru un e-mail ales.
 * Se înregistrează doar când NODE_ENV !== 'production' și AUTH_JWT_SECRET e setat.
 * În producție, token-ul vine de la furnizorul de identitate (Cognito/Auth0/Clerk).
 */
import { createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { z } from 'zod';

/** UUID determinist din e-mail: aceeași adresă => același utilizator la fiecare login. */
export function devUserId(email) {
  const h = createHash('sha256').update(`pbn-dev:${email.toLowerCase()}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export default async function devRoutes(app, { deps }) {
  const secret = new TextEncoder().encode(deps.cfg.AUTH_JWT_SECRET);
  app.post('/v1/dev/session', async (req) => {
    const { email, plan } = z.object({
      email: z.email().max(200),
      plan: z.enum(['free', 'premium']).default('premium'),
    }).parse(req.body ?? {});
    const id = devUserId(email);
    await deps.db.query(
      `INSERT INTO users (id, email, plan) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET plan = EXCLUDED.plan`, [id, email, plan]);
    const token = await new SignJWT({ email }).setProtectedHeader({ alg: 'HS256' })
      .setSubject(id).setIssuedAt().setExpirationTime('12h').sign(secret);
    return { token, user: { id, email, plan } };
  });
}

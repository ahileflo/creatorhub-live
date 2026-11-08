/**
 * OAuth 2.0 Google (Authorization Code + PKCE) pentru Google Photos Picker API.
 *
 * - Scope minim: `photospicker.mediaitems.readonly` — accesăm DOAR pozele pe
 *   care utilizatorul le alege explicit în interfața Google, nu toată biblioteca.
 * - `access_type=offline` + `prompt=consent` => primim refresh token, ca worker-ul
 *   să poată descărca pozele fără ca utilizatorul să fie online.
 * - `state` (anti-CSRF) și `code_verifier` (PKCE) stau în Redis 10 minute.
 * - Token-urile se salvează criptate (envelope encryption, vezi crypto/keys.js).
 */
import { createHash, randomBytes } from 'node:crypto';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
export const PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
export const SCOPES = ['openid', PICKER_SCOPE];

const STATE_TTL_S = 600;
const TOKEN_CONTEXT = 'google-oauth-token';
const b64url = (buf) => Buffer.from(buf).toString('base64url');

export class GoogleOAuthError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code; // ex. 'invalid_grant' => refresh token revocat/expirat
  }
}

export class GoogleOAuth {
  /**
   * @param {{ clientId: string, clientSecret: string, redirectUri: string,
   *           redis: import('ioredis').Redis, fetch?: typeof fetch }} opts
   */
  constructor({ clientId, clientSecret, redirectUri, redis, fetch: f = globalThis.fetch }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.redis = redis;
    this.fetch = f;
  }

  /** Pasul 1: URL-ul către ecranul de consimțământ Google. */
  async createAuthorizationUrl({ userId, returnTo = '/' }) {
    const state = b64url(randomBytes(32));
    const codeVerifier = b64url(randomBytes(64)); // 86 caractere (RFC 7636: 43–128)
    const codeChallenge = b64url(createHash('sha256').update(codeVerifier).digest());
    await this.redis.set(`oauth:google:state:${state}`,
      JSON.stringify({ userId, codeVerifier, returnTo }), 'EX', STATE_TTL_S);

    const url = new URL(GOOGLE_AUTH_URL);
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return { url: url.toString(), state };
  }

  /** Consumă `state` o singură dată (GETDEL): un callback re-jucat e respins. */
  async consumeState(state) {
    if (!state || typeof state !== 'string') return null;
    const raw = await this.redis.getdel(`oauth:google:state:${state}`);
    return raw ? JSON.parse(raw) : null;
  }

  async #tokenRequest(params) {
    const res = await this.fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId, client_secret: this.clientSecret, ...params,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new GoogleOAuthError(`Google token endpoint: ${body.error_description ?? res.status}`,
        { status: res.status, code: body.error });
    }
    return body;
  }

  /** Pasul 2: schimbă `code` pe token-uri (cu `code_verifier` PKCE). */
  async exchangeCode({ code, codeVerifier }) {
    const t = await this.#tokenRequest({
      grant_type: 'authorization_code', code, code_verifier: codeVerifier, redirect_uri: this.redirectUri,
    });
    const granted = String(t.scope ?? '').split(' ');
    if (!granted.includes(PICKER_SCOPE)) {
      // Utilizatorul a debifat permisiunea Photos în ecranul de consimțământ.
      throw new GoogleOAuthError('Photos picker scope was not granted', { code: 'scope_denied' });
    }
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000), // marjă de 60 s
      scopes: granted,
      idToken: t.id_token,
    };
  }

  async refresh(refreshToken) {
    const t = await this.#tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
    return { accessToken: t.access_token, expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000) };
  }

  async revoke(token) {
    await this.fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  }

  async fetchAccountId(accessToken) {
    const res = await this.fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new GoogleOAuthError('userinfo failed', { status: res.status });
    return (await res.json()).sub;
  }
}

// ---------------------------------------------------------------------------
// Persistența conexiunii (token-uri criptate)
// ---------------------------------------------------------------------------
export async function saveConnection(db, keyProvider, { userId, accountId, tokens }) {
  const ctx = `${TOKEN_CONTEXT}:${userId}`;
  if (!tokens.refreshToken) {
    // Google nu retrimite refresh token dacă există deja un grant; cu prompt=consent
    // ar trebui să vină mereu. Dacă lipsește, nu putem lucra offline.
    throw new GoogleOAuthError('Google did not return a refresh token', { code: 'no_refresh_token' });
  }
  await db.query(
    `INSERT INTO oauth_connections
       (user_id, provider, provider_account_id, scopes, refresh_token_enc,
        access_token_enc, access_expires_at, kms_key_id)
     VALUES ($1, 'google', $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, provider) DO UPDATE SET
       provider_account_id = EXCLUDED.provider_account_id, scopes = EXCLUDED.scopes,
       refresh_token_enc = EXCLUDED.refresh_token_enc, access_token_enc = EXCLUDED.access_token_enc,
       access_expires_at = EXCLUDED.access_expires_at, kms_key_id = EXCLUDED.kms_key_id,
       revoked_at = NULL, updated_at = now()`,
    [userId, accountId, tokens.scopes,
      await keyProvider.encrypt(tokens.refreshToken, ctx),
      await keyProvider.encrypt(tokens.accessToken, ctx),
      tokens.expiresAt, keyProvider.keyId],
  );
}

/**
 * Returnează un access token valid (reîmprospătat dacă a expirat).
 * Aruncă GoogleOAuthError{code:'not_connected'|'invalid_grant'} dacă reconectarea e necesară.
 */
export async function getAccessToken(db, keyProvider, oauth, userId) {
  const ctx = `${TOKEN_CONTEXT}:${userId}`;
  const { rows } = await db.query(
    `SELECT refresh_token_enc, access_token_enc, access_expires_at FROM oauth_connections
      WHERE user_id = $1 AND provider = 'google' AND revoked_at IS NULL`, [userId]);
  if (!rows.length) throw new GoogleOAuthError('Google Photos not connected', { code: 'not_connected' });
  const row = rows[0];
  if (row.access_token_enc && row.access_expires_at > new Date()) {
    return (await keyProvider.decrypt(row.access_token_enc, ctx)).toString();
  }
  const refreshToken = (await keyProvider.decrypt(row.refresh_token_enc, ctx)).toString();
  try {
    const t = await oauth.refresh(refreshToken);
    await db.query(
      `UPDATE oauth_connections SET access_token_enc = $2, access_expires_at = $3, updated_at = now()
        WHERE user_id = $1 AND provider = 'google'`,
      [userId, await keyProvider.encrypt(t.accessToken, ctx), t.expiresAt]);
    return t.accessToken;
  } catch (err) {
    if (err.code === 'invalid_grant') {
      // Utilizatorul a revocat accesul din contul Google: marcăm conexiunea.
      await db.query(`UPDATE oauth_connections SET revoked_at = now() WHERE user_id = $1 AND provider = 'google'`, [userId]);
    }
    throw err;
  }
}

export async function disconnect(db, keyProvider, oauth, userId) {
  const { rows } = await db.query(
    `SELECT refresh_token_enc FROM oauth_connections
      WHERE user_id = $1 AND provider = 'google' AND revoked_at IS NULL`, [userId]);
  if (rows.length) {
    const token = (await keyProvider.decrypt(rows[0].refresh_token_enc, `${TOKEN_CONTEXT}:${userId}`)).toString();
    await oauth.revoke(token).catch(() => {}); // revocarea la Google e best-effort
  }
  await db.query(
    `UPDATE oauth_connections SET revoked_at = now(), access_token_enc = NULL
      WHERE user_id = $1 AND provider = 'google'`, [userId]);
}

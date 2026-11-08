// MODUL 2a — Import direct din Google Photos (pachet Premium)
//
// IMPORTANT (schimbare Google, 31 martie 2025): scope-urile largi ale Library API
// (photoslibrary.readonly) au fost retrase pentru aplicații terțe. Singura cale oficială de a
// citi poze din biblioteca personală a utilizatorului este **Google Photos Picker API**:
// utilizatorul alege pozele în interfața Google, iar noi primim DOAR acele poze.
// Avantaj: scope minim => verificarea OAuth la Google e mult mai simplă, iar clientul are încredere.
//
// Flux:
//   1. /auth/google           -> redirect la consimțământ OAuth (scope photospicker.mediaitems.readonly)
//   2. /auth/google/callback  -> schimbăm `code` pe access_token (îl ținem DOAR în sesiune, nu în DB)
//   3. POST /api/google/sessions        -> creăm o sesiune Picker, primim pickerUri
//   4. Frontend-ul deschide pickerUri (+ "/autoclose"), utilizatorul alege poza
//   5. GET  /api/google/sessions/:id    -> polling până când mediaItemsSet === true
//   6. POST /api/google/sessions/:id/import -> listăm item-urile, descărcăm baseUrl + "=d" (original),
//      urcăm în S3 și punem jobul în coadă. Apoi ștergem sesiunea Picker.

import crypto from 'node:crypto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PICKER = 'https://photospicker.googleapis.com/v1';
const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

const redirectUri = () => `${process.env.PUBLIC_URL}/auth/google/callback`;

export function authRedirect(req, res) {
  // `state` anti-CSRF legat de sesiune
  req.session.oauthState = crypto.randomBytes(16).toString('hex');
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    state: req.session.oauthState,
    access_type: 'online', // nu cerem refresh token: accesul e doar pe durata comenzii
    include_granted_scopes: 'true',
    prompt: 'consent',
  });
  res.redirect(`${AUTH_URL}?${q}`);
}

export async function authCallback(req, res) {
  if (!req.query.code || req.query.state !== req.session.oauthState) {
    return res.status(400).send('OAuth state invalid');
  }
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: req.query.code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!r.ok) return res.status(502).send('Schimbul de token a eșuat');
  const tok = await r.json();
  req.session.google = { accessToken: tok.access_token, expiresAt: Date.now() + tok.expires_in * 1000 };
  delete req.session.oauthState;
  res.redirect('/premium-import.html?google=connected');
}

function token(req) {
  const g = req.session.google;
  if (!g || g.expiresAt < Date.now() + 30_000) {
    const e = new Error('Google neconectat sau token expirat'); e.status = 401; throw e;
  }
  return g.accessToken;
}

async function picker(req, path, init = {}) {
  const r = await fetch(`${PICKER}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token(req)}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!r.ok) { const e = new Error(`Picker API ${r.status}: ${await r.text()}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}

export async function createSession(req, res) {
  const s = await picker(req, '/sessions', { method: 'POST', body: JSON.stringify({ pickingConfig: { maxItemCount: '1' } }) });
  // pickerUri + "/autoclose" => fereastra Google se închide singură după selecție
  res.json({ id: s.id, pickerUri: `${s.pickerUri}/autoclose`, pollingConfig: s.pollingConfig });
}

export async function getSession(req, res) {
  const s = await picker(req, `/sessions/${encodeURIComponent(req.params.id)}`);
  res.json({ id: s.id, mediaItemsSet: !!s.mediaItemsSet, pollingConfig: s.pollingConfig });
}

/** Descarcă pozele selectate și le returnează ca Buffer-e (apelantul le urcă în S3). */
export async function fetchPickedItems(req, sessionId) {
  const list = await picker(req, `/mediaItems?${new URLSearchParams({ sessionId, pageSize: '10' })}`);
  const out = [];
  for (const item of list.mediaItems || []) {
    if (item.type !== 'PHOTO') continue;
    const f = item.mediaFile;
    // "=d" = descarcă originalul cu metadate EXIF; baseUrl expiră în ~60 min și cere header-ul Bearer
    const r = await fetch(`${f.baseUrl}=d`, { headers: { Authorization: `Bearer ${token(req)}` } });
    if (!r.ok) throw new Error(`Download eșuat ${r.status}`);
    out.push({
      buffer: Buffer.from(await r.arrayBuffer()),
      mimeType: f.mimeType,
      filename: f.filename,
      width: f.mediaFileMetadata?.width, height: f.mediaFileMetadata?.height,
      googleId: item.id,
    });
  }
  // curățenie: sesiunea Picker nu mai e necesară
  await picker(req, `/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => {});
  return out;
}

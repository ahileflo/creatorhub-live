import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GoogleOAuth, PICKER_SCOPE } from '../src/integrations/google/oauth.js';
import { GooglePhotosPicker, parseDurationMs } from '../src/integrations/google/picker.js';
import { safeReturnPath } from '../src/routes/google.js';
import { fakeFetch, fakeRedis } from './helpers.js';

function oauthWith(fetch) {
  const redis = fakeRedis();
  return { redis, oauth: new GoogleOAuth({
    clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://api.example/cb', redis, fetch,
  }) };
}

test('authorization URL uses PKCE S256, offline access and the picker scope', async () => {
  const { oauth, redis } = oauthWith(fakeFetch([]));
  const { url, state } = await oauth.createAuthorizationUrl({ userId: 'u1', returnTo: '/order' });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.ok(u.searchParams.get('scope').split(' ').includes(PICKER_SCOPE));

  const saved = JSON.parse(await redis.get(`oauth:google:state:${state}`));
  const expected = createHash('sha256').update(saved.codeVerifier).digest('base64url');
  assert.equal(u.searchParams.get('code_challenge'), expected);
  assert.ok(saved.codeVerifier.length >= 43 && saved.codeVerifier.length <= 128);

  // `state` se poate folosi o singură dată.
  assert.deepEqual(await oauth.consumeState(state), saved);
  assert.equal(await oauth.consumeState(state), null);
});

test('code exchange sends the verifier and rejects a missing photos scope', async () => {
  let scope = `openid ${PICKER_SCOPE}`;
  const f = fakeFetch([{
    match: (url) => url === 'https://oauth2.googleapis.com/token',
    reply: () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope }),
  }]);
  const { oauth } = oauthWith(f);
  const t = await oauth.exchangeCode({ code: 'c', codeVerifier: 'v'.repeat(64) });
  assert.equal(t.refreshToken, 'rt');
  const sent = new URLSearchParams(f.calls[0].init.body);
  assert.equal(sent.get('code_verifier'), 'v'.repeat(64));
  assert.equal(sent.get('grant_type'), 'authorization_code');

  scope = 'openid';
  await assert.rejects(oauth.exchangeCode({ code: 'c', codeVerifier: 'v'.repeat(64) }), { code: 'scope_denied' });
});

test('refresh surfaces invalid_grant so the user can reconnect', async () => {
  const f = fakeFetch([{
    match: () => true,
    reply: () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
  }]);
  await assert.rejects(oauthWith(f).oauth.refresh('rt'), { code: 'invalid_grant' });
});

test('picker: durations, session creation and paginated listing', async () => {
  assert.equal(parseDurationMs('5s', 0), 5000);
  assert.equal(parseDurationMs('1.5s', 0), 1500);
  assert.equal(parseDurationMs(undefined, 42), 42);

  const f = fakeFetch([
    { match: (u, i) => u.endsWith('/v1/sessions') && i.method === 'POST',
      reply: () => ({ id: 's1', pickerUri: 'https://photos.google.com/picker/s1', mediaItemsSet: false,
        pollingConfig: { pollInterval: '3s', timeoutIn: '1800s' }, expireTime: '2030-01-01T00:00:00Z' }) },
    { match: (u) => u.includes('/mediaItems') && !u.includes('pageToken'),
      reply: () => ({ mediaItems: [{ id: 'm1', type: 'PHOTO' }], nextPageToken: 'p2' }) },
    { match: (u) => u.includes('pageToken=p2'), reply: () => ({ mediaItems: [{ id: 'm2', type: 'PHOTO' }] }) },
  ]);
  const picker = new GooglePhotosPicker({ fetch: f });
  const s = await picker.createSession('tok', { maxItemCount: 3 });
  assert.equal(s.pollIntervalMs, 3000);
  assert.equal(s.timeoutMs, 1_800_000);
  assert.equal(JSON.parse(f.calls[0].init.body).pickingConfig.maxItemCount, '3');
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer tok');

  const items = await picker.listMediaItems('tok', 's1');
  assert.deepEqual(items.map((i) => i.id), ['m1', 'm2']);
});

test('picker download requests the original (=d) and enforces the size cap', async () => {
  const f = fakeFetch([{
    match: (u) => u === 'https://lh3.example/abc=d',
    reply: () => new Response(new Uint8Array(1000), { headers: { 'content-type': 'image/jpeg' } }),
  }]);
  const picker = new GooglePhotosPicker({ fetch: f });
  const item = { mediaFile: { baseUrl: 'https://lh3.example/abc', mimeType: 'image/jpeg' } };
  const { bytes } = await picker.downloadPhoto('tok', item, { maxBytes: 5000 });
  assert.equal(bytes.length, 1000);
  await assert.rejects(picker.downloadPhoto('tok', item, { maxBytes: 500 }), { status: 413 });
});

test('returnTo only accepts same-site relative paths', () => {
  assert.equal(safeReturnPath('/orders/new?x=1'), '/orders/new?x=1');
  for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', 42]) {
    assert.equal(safeReturnPath(bad), '/');
  }
});

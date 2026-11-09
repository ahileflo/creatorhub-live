/** Utilitare de test: Redis în memorie și un `fetch` fals cu rute. */

export function fakeRedis() {
  const m = new Map();
  return {
    m,
    async set(k, v) { m.set(k, v); return 'OK'; },
    async get(k) { return m.get(k) ?? null; },
    async getdel(k) { const v = m.get(k) ?? null; m.delete(k); return v; },
  };
}

/**
 * fakeFetch([{ match: (url, init) => bool, reply: (url, init) => Response | object }])
 * Înregistrează toate apelurile în `.calls`.
 */
export function fakeFetch(routes) {
  const calls = [];
  const f = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes.find((r) => r.match(url, init));
    if (!route) return new Response(JSON.stringify({ error: 'no route' }), { status: 599 });
    const out = await route.reply(url, init);
    return out instanceof Response ? out : Response.json(out);
  };
  f.calls = calls;
  return f;
}

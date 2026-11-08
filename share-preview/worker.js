// Pas cu Gust — previzualizarea linkurilor de rețetă (WhatsApp, Facebook, Telegram, iMessage...).
//
// Aplicațiile de chat nu rulează JavaScript: citesc doar etichetele <meta property="og:..."> din HTML-ul
// primit de la server. GitHub Pages servește doar fișiere statice, iar Supabase nu servește HTML,
// așa că acest worker mic face legătura:
//   GET /r/<id>  →  pagină cu titlul, descrierea și poza rețetei  →  omul ajunge imediat în aplicație.
//
// Variabile (Cloudflare → Worker → Settings → Variables):
//   SUPABASE_URL       https://ttvdkkmjboivafypztnk.supabase.co
//   SUPABASE_ANON_KEY  cheia publică (anon) a proiectului
//   APP_URL            https://ahileflo.github.io/creatorhub-live/pascugust/

const ID = /^\/r\/([A-Za-z0-9]{8,16})\/?$/;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cut = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const fmtTime = min => !min ? '' : min >= 60 ? Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '') : min + ' min';

async function loadRecipe(id, env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_shared_recipe`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ share_id: id }),
  });
  if (!res.ok) return null;
  return await res.json(); // null când linkul a fost oprit
}

export function renderPage(r, { id, appUrl, publicPrefix, selfUrl }) {
  const target = `${appUrl}?r=${id}`;
  const image = [r.og, r.cover].find(u => typeof u === 'string' && u.startsWith(publicPrefix)) || `${appUrl}icons/og-app.jpg`;
  const title = cut(r.title || 'Rețetă', 90);
  const steps = Array.isArray(r.steps) ? r.steps.length : 0;
  const details = [steps ? `${steps} pași` : '', fmtTime(+r.time), r.author ? `de ${cut(r.author, 40)}` : ''].filter(Boolean).join(' · ');
  const desc = cut([r.desc, details].filter(Boolean).join(' — '), 200) || 'Rețetă pas cu pas, cu poze și video.';
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Pas cu Gust</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(selfUrl || target)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Pas cu Gust">
<meta property="og:locale" content="ro_RO">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(selfUrl || target)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#e8603c">
<style>body{font-family:system-ui,sans-serif;background:#fff8f2;color:#2b1d16;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}a{color:#e8603c;font-weight:700}</style>
</head>
<body>
<main><p>Se deschide rețeta <b>${esc(title)}</b>…</p><p><a href="${esc(target)}">Deschide în Pas cu Gust</a></p></main>
<script>location.replace(${JSON.stringify(target)})</script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const appUrl = (env.APP_URL || 'https://ahileflo.github.io/creatorhub-live/pascugust/').replace(/\/?$/, '/');
    const url = new URL(request.url);
    const m = url.pathname.match(ID);
    if (!m || (request.method !== 'GET' && request.method !== 'HEAD')) return Response.redirect(appUrl, 302);
    const id = m[1];

    // Răspunsurile se țin 5 minute în cache-ul Cloudflare: un link trimis pe un grup mare nu lovește baza de date de fiecare dată.
    const cache = caches.default;
    const key = new Request(url.origin + url.pathname, { method: 'GET' });
    let res = await cache.match(key);
    if (!res) {
      let r = null;
      try { r = await loadRecipe(id, env); } catch (e) { r = null; }
      if (!r) return Response.redirect(`${appUrl}?r=${id}`, 302); // link oprit: aplicația afișează „Linkul nu mai există”
      const html = renderPage(r, { id, appUrl, publicPrefix: `${env.SUPABASE_URL}/storage/v1/object/public/pascugust-public/`, selfUrl: url.origin + url.pathname });
      res = new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    return request.method === 'HEAD' ? new Response(null, res) : res;
  },
};

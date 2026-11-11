// Pas cu Gust — importă o rețetă dintr-un link.
// Site-urile de rețete (cele găsite pe Google) publică rețeta ca date structurate schema.org/Recipe,
// pe care le citim; pentru YouTube / TikTok luăm titlul și autorul (oEmbed). Nu descărcăm poze sau clipuri.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_BYTES = 2_000_000;
const clean = (s: unknown, n = 2000) =>
  String(s ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim().slice(0, n);

// PT1H30M → 90
export function minutes(iso: unknown) {
  const m = String(iso || "").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  return m ? (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0;
}
function findRecipe(node: any): any {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const t = node["@type"];
  if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
  return findRecipe(node["@graph"]) || findRecipe(node.mainEntity) || null;
}
function steps(ins: any): string[] {
  if (!ins) return [];
  if (typeof ins === "string") return ins.split(/\n+|(?<=\.)\s+(?=[A-ZĂÂÎȘȚ])/).map((s) => clean(s, 600)).filter(Boolean);
  if (Array.isArray(ins)) return ins.flatMap((x) => steps(x));
  if (ins["@type"] === "HowToSection") return steps(ins.itemListElement);
  return [clean(ins.text || ins.name, 600)].filter(Boolean);
}
export function parseRecipe(html: string, url: string) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const r = findRecipe(data);
    if (!r) continue;
    const author = Array.isArray(r.author) ? r.author[0]?.name : (r.author?.name ?? r.author);
    const yieldv = Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield;
    return {
      kind: "recipe",
      title: clean(r.name, 200),
      desc: clean(r.description, 600),
      ingredients: (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map((x: unknown) => clean(x, 200)).filter(Boolean).slice(0, 80),
      steps: steps(r.recipeInstructions).slice(0, 60),
      time: minutes(r.totalTime) || minutes(r.cookTime) + minutes(r.prepTime),
      servings: parseInt(String(yieldv ?? "")) || null,
      author: clean(author, 100),
      site: new URL(url).hostname.replace(/^www\./, ""),
    };
  }
  const meta = (p: string) => clean(html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)`, "i"))?.[1], 600);
  const title = meta("og:title") || clean(html.match(/<title>([^<]*)/i)?.[1], 200);
  return title ? { kind: "page", title, desc: meta("og:description"), site: new URL(url).hostname.replace(/^www\./, "") } : null;
}

// doar adrese publice http(s), fără IP-uri și nume interne
function publicUrl(u: URL) {
  return /^https?:$/.test(u.protocol) && u.hostname.includes(".") && !u.port.length &&
    !/^(\d+\.){3}\d+$|^\[|localhost|\.local$|\.internal$|\.lan$/i.test(u.hostname);
}

async function oembed(url: string) {
  const h = new URL(url).hostname.replace(/^(www|m|vm|vt)\./, "");
  const ep = h === "youtube.com" || h === "youtu.be" ? "https://www.youtube.com/oembed?format=json&url="
    : /(^|\.)tiktok\.com$/.test(h) ? "https://www.tiktok.com/oembed?url=" : null;
  if (!ep) return null;
  const r = await fetch(ep + encodeURIComponent(url), { signal: AbortSignal.timeout(6000) });
  if (!r.ok) return null;
  const j = await r.json();
  return { kind: "video", title: clean(j.title, 200), author: clean(j.author_name, 100), site: h };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);
  try {
    const { url } = await req.json().catch(() => ({}));
    let u: URL;
    try { u = new URL(String(url || "").trim()); } catch { return json({ ok: false, reason: "url" }, 400); }
    if (!publicUrl(u)) return json({ ok: false, reason: "url" }, 400);

    const host = u.hostname.replace(/^(www|m)\./, "");
    if (host === "instagram.com") return json({ ok: true, data: { kind: "video", title: "", author: "", site: host } });
    const video = await oembed(u.href).catch(() => null);
    if (video) return json({ ok: true, data: video });

    // redirecționările le urmăm noi, ca să verificăm fiecare adresă
    let res: Response | null = null, at = u;
    for (let hop = 0; hop < 5; hop++) {
      res = await fetch(at.href, {
        redirect: "manual", signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PasCuGust/1.0; +https://ahileflo.github.io/creatorhub-live/pascugust/)", Accept: "text/html" },
      });
      const loc = res.status >= 300 && res.status < 400 && res.headers.get("location");
      if (!loc) break;
      at = new URL(loc, at);
      if (!publicUrl(at)) return json({ ok: false, reason: "url" }, 400);
    }
    if (!res || !res.ok) return json({ ok: false, reason: "fetch" }, 502);
    const reader = res.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > MAX_BYTES) { await reader.cancel(); break; }
      chunks.push(value);
    }
    const buf = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    chunks.reduce((o, c) => (buf.set(c, o), o + c.length), 0);
    const html = new TextDecoder().decode(buf);
    const data = parseRecipe(html, at.href);
    return data ? json({ ok: true, data }) : json({ ok: false, reason: "no_recipe" }, 422);
  } catch (_e) {
    return json({ ok: false, reason: "server" }, 500);
  }
});

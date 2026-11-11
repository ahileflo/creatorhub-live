// Pas cu Gust — activează Premium cu cheia de licență primită la cumpărarea de pe Gumroad.
// Cheia se verifică direct la Gumroad (API public de licențe), apoi se leagă de un singur cont.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// câte zile de Premium dă fiecare perioadă de facturare (cu câteva zile de rezervă pentru reînnoire)
const DAYS: Record<string, number> = { monthly: 35, quarterly: 96, biannually: 190, yearly: 372, every_two_years: 735 };

export async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toUpperCase()));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user }, error: ue } = await admin.auth.getUser(token);
    if (ue || !user) return json({ ok: false, reason: "auth" }, 401);

    const { license_key } = await req.json().catch(() => ({}));
    const key = String(license_key || "").trim();
    if (!/^[A-Z0-9-]{16,64}$/i.test(key)) return json({ ok: false, reason: "format" }, 400);

    const { data: productId } = await admin.rpc("svc_config", { k: "gumroad_product_id" });
    if (!productId) return json({ ok: false, reason: "not_configured" }, 503);

    const r = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      body: new URLSearchParams({ product_id: String(productId), license_key: key, increment_uses_count: "false" }),
    });
    const g = await r.json().catch(() => ({}));
    if (!g.success) return json({ ok: false, reason: "invalid" }, 400);
    const p = g.purchase || {};
    if (p.refunded || p.chargebacked || p.disputed) return json({ ok: false, reason: "refunded" }, 400);
    if (p.subscription_ended_at || p.subscription_failed_at) return json({ ok: false, reason: "ended" }, 400);

    const rec = String(p.recurrence || "monthly");
    const { data, error } = await admin.rpc("svc_grant_license", {
      uid: user.id, lic_hash: await sha256(key), days: DAYS[rec] ?? 35, src: "gumroad:" + rec,
    });
    if (error) throw error;
    if (data?.ok) await admin.from("events").insert({ name: "premium", src: rec.slice(0, 20) });
    return json(data, data?.ok ? 200 : 409);
  } catch (_e) {
    return json({ ok: false, reason: "server" }, 500);
  }
});

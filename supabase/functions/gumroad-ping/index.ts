// Pas cu Gust — primește notificările de vânzare de la Gumroad („Ping”) pentru panoul de creștere:
// vânzări, venit și comisioanele afiliaților. Reînnoirile de abonament prelungesc Premium.
// Adresa trimisă la Gumroad conține un cod secret (?k=…) păstrat doar în baza de date.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const DAYS: Record<string, number> = { monthly: 35, quarterly: 96, biannually: 190, yearly: 372, every_two_years: 735 };

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toUpperCase()));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// comparație în timp constant, ca secretul să nu poată fi ghicit caracter cu caracter
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secret } = await admin.rpc("svc_config", { k: "gumroad_ping_secret" });
    const k = new URL(req.url).searchParams.get("k") || "";
    if (!secret || !same(k, String(secret))) return new Response("forbidden", { status: 403 });

    const form = await req.formData();
    const p: Record<string, string> = {};
    for (const [key, v] of form.entries()) if (typeof v === "string") p[key] = v.slice(0, 500);
    if (!p.sale_id) return new Response("ignored", { status: 200 });

    const { data, error } = await admin.rpc("svc_record_sale", { p });
    if (error) throw error;

    const refunded = p.refunded === "true" || p.disputed === "true";
    if (p.license_key && !refunded && data?.ok) {
      await admin.rpc("svc_extend_license", { lic_hash: await sha256(p.license_key), days: DAYS[p.recurrence] ?? 35 });
    }
    return new Response(data?.ok ? "ok" : "ignored", { status: 200 });
  } catch (_e) {
    return new Response("error", { status: 500 });
  }
});

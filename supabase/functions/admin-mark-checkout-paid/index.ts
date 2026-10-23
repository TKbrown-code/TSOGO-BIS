import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { sendOrderConfirmationEmail } from "./_shared/order-confirmation-email.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const origin = (Deno.env.get("APP_URL") ?? "https://tsogo-bis.vercel.app").replace(/\/$/, "");
const headers = (requestOrigin: string | null) => ({
  "Access-Control-Allow-Origin": requestOrigin === "http://localhost:5173" ? requestOrigin : origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (req) => {
  const cors = headers(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  if (!url || !anon || !service) return Response.json({ error: "Payment admin service is not configured" }, { status: 503, headers: cors });
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Sign in required" }, { status: 401, headers: cors });
    const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const { data: userResult, error: authError } = await caller.auth.getUser(token);
    if (authError || !userResult.user) return Response.json({ error: "Session expired" }, { status: 401, headers: cors });
    const { data: isAdmin, error: roleError } = await caller.rpc("is_admin");
    if (roleError || !isAdmin) return Response.json({ error: "Administrator access required" }, { status: 403, headers: cors });
    const body = await req.json().catch(() => null);
    if (!body?.checkoutId || !/^\d+$/.test(String(body.checkoutId))) return Response.json({ error: "Valid order ID required" }, { status: 400, headers: cors });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: checkout, error } = await admin.from("checkouts").update({ payment_status: "paid", status: "paid", payment_method: "WhatsApp", inventory_reserved: false })
      .eq("checkout_id", body.checkoutId).select("checkout_id").maybeSingle();
    if (error || !checkout) throw new Error(error?.message ?? "Order not found");
    const email = await sendOrderConfirmationEmail(admin, checkout.checkout_id);
    return Response.json({ success: true, emailSent: email.sent }, { headers: cors });
  } catch (error) {
    console.error("Admin payment confirmation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not mark payment complete" }, { status: 500, headers: cors });
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { sendOrderConfirmationEmail } from "./_shared/order-confirmation-email.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const apiKey = (Deno.env.get("FAPSHI_API_KEY") ?? "").trim();
const apiUser = (Deno.env.get("FAPSHI_API_USER") ?? "").trim();
const baseUrl = (Deno.env.get("FAPSHI_BASE_URL") ?? "https://sandbox.fapshi.com").trim().replace(/\/$/, "");
const appUrl = (Deno.env.get("APP_URL") ?? "https://tsogo-bis.vercel.app").replace(/\/$/, "");
const allowedOrigins = new Set([appUrl, "http://localhost:5173", "http://127.0.0.1:5173"]);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : appUrl,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Vary": "Origin",
});

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  if (!supabaseUrl || !anonKey || !serviceKey) return Response.json({ error: "Service unavailable" }, { status: 503, headers });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Sign in to continue" }, { status: 401, headers });
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(authorization.slice(7));
    if (authError || !user) return Response.json({ error: "Invalid session" }, { status: 401, headers });
    const body = await req.json().catch(() => null);
    if (!body || (typeof body.checkoutId !== "string" && typeof body.checkoutId !== "number")) {
      return Response.json({ error: "Invalid checkout ID" }, { status: 400, headers });
    }
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.from("checkouts")
      .select("checkout_id,status,payment_status,payment_reference,payment_url,total,payment_provider")
      .eq("checkout_id", body.checkoutId).eq("user_id", user.id).maybeSingle();
    if (error || !data) return Response.json({ error: "Checkout not found" }, { status: 404, headers });
    // Fapshi webhooks are the primary notification. Also reconcile on the
    // authenticated customer's return to /orders in case no webhook arrives.
    if (data.payment_provider === "fapshi" && data.payment_reference
      && !["paid", "failed", "expired"].includes(data.payment_status) && apiKey && apiUser) {
      try {
        const response = await fetch(`${baseUrl}/payment-status/${encodeURIComponent(data.payment_reference)}`, {
          headers: { apikey: apiKey, apiuser: apiUser },
          signal: AbortSignal.timeout(8000),
        });
        const verified = await response.json().catch(() => null);
        const expectedExternalId = `checkout_${data.checkout_id}`;
        if (response.ok && verified?.transId === data.payment_reference
          && verified?.externalId === expectedExternalId && verified?.transType === "Collection"
          && Math.round(Number(data.total)) === Number(verified.amount)
          && ["SUCCESSFUL", "FAILED", "EXPIRED", "PENDING", "CREATED"].includes(verified.status)) {
          const { error: updateError } = await admin.rpc("set_fapshi_checkout_payment", {
            p_checkout_id: String(data.checkout_id),
            p_payment_status: String(verified.status),
            p_payment_reference: String(verified.transId),
          });
          if (updateError) console.error("Fapshi status reconciliation failed:", updateError.message);
          else data.payment_status = verified.status === "SUCCESSFUL" ? "paid"
            : verified.status === "FAILED" ? "failed"
            : verified.status === "EXPIRED" ? "expired"
            : verified.status === "PENDING" ? "processing" : "pending";
        }
      } catch (verifyError) {
        // A temporary provider outage should not prevent showing the saved state.
        console.warn("Fapshi status check unavailable:", verifyError);
      }
    }
    if (data.payment_status === "paid") {
      try {
        await sendOrderConfirmationEmail(admin, data.checkout_id);
      } catch (emailError) {
        // Payment remains successful; a retryable email job records the delivery failure.
        console.error("Paid order confirmation email failed:", emailError);
      }
    }
    return Response.json({ success: true, checkoutId: data.checkout_id, status: data.payment_status,
      orderStatus: data.status, reference: data.payment_reference, paymentUrl: data.payment_url,
      total: data.total }, { status: 200, headers });
  } catch (error) {
    console.error("Checkout status read failed:", error);
    return Response.json({ error: "Could not read checkout status" }, { status: 500, headers });
  }
});

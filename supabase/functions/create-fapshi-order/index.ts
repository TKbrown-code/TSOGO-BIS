import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const apiKey = (Deno.env.get("FAPSHI_API_KEY") ?? "").trim();
const apiUser = (Deno.env.get("FAPSHI_API_USER") ?? "").trim();
// Development is the safe default; set FAPSHI_BASE_URL explicitly for production.
const baseUrl = (Deno.env.get("FAPSHI_BASE_URL") ?? "https://sandbox.fapshi.com").trim().replace(/\/$/, "");
const appUrl = (Deno.env.get("APP_URL") ?? "https://tsogo-bis.vercel.app").replace(/\/$/, "");

const corsHeaders = (origin: string | null) => {
  const allowed = new Set([appUrl, "http://localhost:5173", "http://127.0.0.1:5173"]);
  return {
    "Access-Control-Allow-Origin": origin && allowed.has(origin) ? origin : appUrl,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Vary": "Origin",
  };
};
const checkoutRedirectOrigin = (origin: string | null) => {
  const allowed = new Set([appUrl, "http://localhost:5173", "http://127.0.0.1:5173"]);
  return origin && allowed.has(origin) ? origin : appUrl;
};
const respond = (body: unknown, status: number, headers: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, headers);
  if (!supabaseUrl || !anonKey || !serviceKey || !apiKey || !apiUser) {
    console.error("Fapshi checkout environment is incomplete");
    return respond({ error: "Payment service is not configured" }, 503, headers);
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in to continue" }, 401, headers);
    const token = authorization.slice("Bearer ".length);
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user?.id || !user.email) return respond({ error: "Your session is invalid. Sign in again." }, 401, headers);

    const body = await req.json().catch(() => null);
    if (!body || typeof body.name !== "string" || typeof body.phone !== "string" || typeof body.address !== "string"
      || typeof body.idempotencyKey !== "string" || !Array.isArray(body.cartItemIds)) {
      return respond({ error: "Invalid checkout details" }, 400, headers);
    }
    if (body.cartItemIds.length < 1 || body.cartItemIds.length > 50
      || body.cartItemIds.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) <= 0)
      || !/^[0-9a-f-]{36}$/i.test(body.idempotencyKey)) {
      return respond({ error: "Invalid cart selection or checkout request key" }, 400, headers);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: checkout, error: checkoutError } = await admin.rpc("create_fapshi_checkout", {
      p_user_id: user.id,
      p_name: body.name.trim(),
      p_email: user.email,
      p_phone: body.phone.trim(),
      p_address: body.address.trim(),
      p_cart_item_ids: body.cartItemIds,
      p_idempotency_key: body.idempotencyKey,
    });
    if (checkoutError || !checkout) {
      const message = checkoutError?.message ?? "Unable to create checkout";
      const status = /stock|unavailable|cart items/i.test(message) ? 409 : /invalid|greater than zero/i.test(message) ? 400 : 500;
      console.error("Atomic checkout creation failed:", checkoutError?.code, message);
      return respond({ error: status === 409 ? "A selected product is out of stock or your cart changed. Refresh your bag and try again." : status === 400 ? message : "Could not create your checkout" }, status, headers);
    }

    const { data: checkoutTotal, error: creditError } = await admin.rpc("apply_referral_store_credit", {
      p_checkout_id: Number(checkout.checkout_id),
      p_user_id: user.id,
      p_use_credit: body.useReferralCredit === true,
    });
    if (creditError || !checkoutTotal) {
      console.error("Could not apply referral store credit:", creditError?.message);
      return respond({ error: "Could not verify your store credit. Please retry checkout." }, 500, headers);
    }

    if (checkoutTotal.payment_status === "paid") {
      return respond({ success: true, checkout_id: checkout.checkout_id, paymentUrl: null,
        reference: null, status: "paid", storeCreditApplied: checkoutTotal.referral_credit_applied }, 200, headers);
    }

    if (checkout.payment_url && checkout.payment_reference) {
      return respond({ success: true, checkout_id: checkout.checkout_id, paymentUrl: checkout.payment_url,
        reference: checkout.payment_reference, status: checkout.payment_status, reused: true,
        storeCreditApplied: checkoutTotal.referral_credit_applied }, 200, headers);
    }
    if (checkout.reused) {
      // A concurrent retry must never create a second provider transaction. The original request owns initiation.
      return respond({ success: true, checkout_id: checkout.checkout_id, paymentUrl: null,
        reference: null, status: checkout.payment_status, reused: true }, 202, headers);
    }

    const externalId = `checkout_${checkout.checkout_id}`;
    const webhookUrl = Deno.env.get("FAPSHI_WEBHOOK_URL") ?? undefined;
    const redirectUrl = `${checkoutRedirectOrigin(req.headers.get("origin"))}/orders?checkout_id=${encodeURIComponent(String(checkout.checkout_id))}`;
    const paymentPayload = {
      amount: Math.round(Number(checkoutTotal.amount_due)),
      email: user.email,
      redirectUrl,
      userId: user.id,
      externalId,
      message: `Payment for order ${checkout.checkout_id}`,
      ...(webhookUrl ? { webhook: webhookUrl } : {}),
    };
    if (!Number.isSafeInteger(paymentPayload.amount) || paymentPayload.amount <= 0) {
      await admin.rpc("set_fapshi_checkout_payment", { p_checkout_id: String(checkout.checkout_id), p_payment_status: "FAILED" });
      return respond({ error: "Order total is invalid for payment" }, 500, headers);
    }

    let providerResponse: Response;
    try {
      providerResponse = await fetch(`${baseUrl}/initiate-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey, apiuser: apiUser },
        body: JSON.stringify(paymentPayload),
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      // An ambiguous timeout must not release stock or initiate a duplicate payment on retry.
      console.error("Fapshi initiation outcome is unknown:", error);
      return respond({ success: true, checkout_id: checkout.checkout_id, paymentUrl: null,
        reference: null, status: "initiating", message: "Payment is being confirmed. Keep this page open." }, 202, headers);
    }
    const providerData = await providerResponse.json().catch(() => null);
    if (!providerResponse.ok || !providerData?.link || !providerData?.transId) {
      const providerMessage = String(providerData?.message ?? "invalid response");
      console.error("Fapshi initiation rejected:", providerResponse.status, providerMessage, {
        baseUrl,
        hasApiUser: Boolean(apiUser),
        hasApiKey: Boolean(apiKey),
      });
      await admin.rpc("set_fapshi_checkout_payment", {
        p_checkout_id: String(checkout.checkout_id), p_payment_status: "FAILED",
      });
      if (/invalid apiuser or apikey/i.test(providerMessage)) {
        return respond({ error: "Fapshi rejected the API credentials. Confirm FAPSHI_API_USER and FAPSHI_API_KEY are from the same Fapshi service and environment as FAPSHI_BASE_URL. The stock reservation has been released." }, 502, headers);
      }
      return respond({ error: `Fapshi could not start this payment (${providerMessage}). Your reserved stock has been released.` }, 502, headers);
    }

    const { error: updateError } = await admin.rpc("set_fapshi_checkout_payment", {
      p_checkout_id: String(checkout.checkout_id),
      p_payment_status: "CREATED",
      p_payment_reference: String(providerData.transId),
      p_payment_url: String(providerData.link),
    });
    if (updateError) {
      console.error("Could not persist Fapshi transaction:", updateError.message);
      // Preserve the reservation: provider has a valid link and may collect payment. Reconciliation can use externalId.
      return respond({ error: "Payment was created but could not be attached to the order. Contact support before retrying.", checkout_id: checkout.checkout_id }, 502, headers);
    }

    return respond({ success: true, checkout_id: checkout.checkout_id, paymentUrl: providerData.link,
      reference: providerData.transId, status: "pending", reused: false,
      storeCreditApplied: checkoutTotal.referral_credit_applied, amountDue: checkoutTotal.amount_due }, 200, headers);
  } catch (error) {
    console.error("Unhandled Fapshi checkout error:", error);
    return respond({ error: "Payment could not be started" }, 500, headers);
  }
});

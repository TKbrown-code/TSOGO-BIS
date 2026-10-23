import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { sendOrderConfirmationEmail } from "./_shared/order-confirmation-email.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const apiKey = (Deno.env.get("FAPSHI_API_KEY") ?? "").trim();
const apiUser = (Deno.env.get("FAPSHI_API_USER") ?? "").trim();
const webhookSecret = (Deno.env.get("FAPSHI_WEBHOOK_SECRET") ?? "").trim();
const baseUrl = (Deno.env.get("FAPSHI_BASE_URL") ?? "https://sandbox.fapshi.com").trim().replace(/\/$/, "");

function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!supabaseUrl || !serviceKey || !apiKey || !apiUser || !webhookSecret) {
    console.error("Fapshi webhook environment is incomplete");
    return new Response("Webhook is not configured", { status: 503 });
  }
  const suppliedSecret = req.headers.get("x-wh-secret") ?? "";
  if (!safeEqual(suppliedSecret, webhookSecret)) return new Response("Unauthorized", { status: 401 });

  try {
    const event = await req.json();
    if (typeof event?.transId !== "string" || typeof event?.externalId !== "string"
      || !/^checkout_[A-Za-z0-9-]+$/.test(event.externalId)) {
      return new Response("Invalid webhook payload", { status: 400 });
    }
    // Never accept payment status from a webhook body alone; verify it against Fapshi.
    const verifyResponse = await fetch(`${baseUrl}/payment-status/${encodeURIComponent(event.transId)}`, {
      headers: { apikey: apiKey, apiuser: apiUser },
      signal: AbortSignal.timeout(10000),
    });
    const verified = await verifyResponse.json().catch(() => null);
    if (!verifyResponse.ok || !verified || verified.transId !== event.transId
      || verified.externalId !== event.externalId || verified.transType !== "Collection") {
      console.error("Fapshi webhook verification failed:", verifyResponse.status);
      return new Response("Payment verification failed", { status: 502 });
    }
    const checkoutId = event.externalId.slice("checkout_".length);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: checkout, error: lookupError } = await admin.from("checkouts")
      .select("checkout_id,total,amount_due,payment_reference,payment_provider")
      .eq("checkout_id", checkoutId).maybeSingle();
    if (lookupError || !checkout || checkout.payment_provider !== "fapshi") {
      console.error("Fapshi webhook checkout lookup failed:", lookupError?.message ?? "not found");
      return new Response("Checkout not found", { status: 404 });
    }
    if ((checkout.payment_reference && checkout.payment_reference !== verified.transId)
      || Math.round(Number(checkout.amount_due ?? checkout.total)) !== Number(verified.amount)) {
      console.error("Fapshi webhook transaction does not match checkout:", checkout.checkout_id);
      return new Response("Payment does not match checkout", { status: 409 });
    }
    const { error: updateError } = await admin.rpc("set_fapshi_checkout_payment", {
      p_checkout_id: String(checkout.checkout_id),
      p_payment_status: String(verified.status),
      p_payment_reference: String(verified.transId),
    });
    if (updateError) {
      console.error("Fapshi webhook database update failed:", updateError.message);
      return new Response("Could not update checkout", { status: 500 });
    }
    if (verified.status === "SUCCESSFUL") {
      try {
        await sendOrderConfirmationEmail(admin, checkout.checkout_id);
      } catch (emailError) {
        console.error("Paid order confirmation email failed:", emailError);
        // Ask Fapshi to retry its notification; the email job is idempotent.
        return new Response("Payment recorded; confirmation email will retry", { status: 500 });
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Fapshi webhook error:", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});

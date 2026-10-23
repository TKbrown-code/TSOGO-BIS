import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const apiKey = (Deno.env.get("FAPSHI_API_KEY") ?? "").trim();
const apiUser = (Deno.env.get("FAPSHI_API_USER") ?? "").trim();
const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
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

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

async function notifyAdminsOfNewOrderSafely(admin: any, checkout: any) {
  if (!resendKey || !resendFrom) {
    console.error("New-order admin email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL is missing");
    return;
  }
  const { data: roles, error: rolesError } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  if (rolesError) {
    console.error("Could not load administrator recipients for new-order email:", rolesError.message);
    return;
  }
  const adminIds = [...new Set((roles ?? []).map((role: any) => role.user_id).filter(Boolean))];
  const [{ data: profiles }, authUsers] = await Promise.all([
    adminIds.length
      ? admin.from("profiles").select("user_id,preferred_language").in("user_id", adminIds)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(adminIds.map(async (id: string) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) {
        console.error("Could not load administrator email recipient:", id, error.message);
        return null;
      }
      return data.user?.email ? { id, email: data.user.email } : null;
    })),
  ]);
  const recipients = authUsers.filter((recipient): recipient is { id: string; email: string } => Boolean(recipient));
  if (!recipients.length) {
    console.error("No administrator email recipients are configured for new orders");
    return;
  }

  const copy: Record<string, Record<string, string>> = {
    en: { subject: `New order #${checkout.checkout_id} received`, title: "A new order has been placed", order: "Order", customer: "Customer", email: "Customer email", phone: "Phone", items: "Items", total: "Order total", payment: "Payment status", shipping: "Delivery fee due on arrival", open: "Open admin dashboard" },
    fr: { subject: `Nouvelle commande n° ${checkout.checkout_id}`, title: "Une nouvelle commande a été passée", order: "Commande", customer: "Client", email: "E-mail du client", phone: "Téléphone", items: "Articles", total: "Total de la commande", payment: "État du paiement", shipping: "Frais de livraison à payer à l’arrivée", open: "Ouvrir le tableau de bord" },
    zh: { subject: `收到新订单 #${checkout.checkout_id}`, title: "有新订单", order: "订单", customer: "客户", email: "客户邮箱", phone: "电话", items: "商品", total: "订单总额", payment: "付款状态", shipping: "收货时支付的配送费", open: "打开管理后台" },
  };
  const profileById = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile.preferred_language]));
  const items = Array.isArray(checkout.items) ? checkout.items : [];
  const rows = items.map((item: any) => {
    const name = item.name || item.product_name || item.product_id?.name || "Product";
    const options = [item.color, item.size].filter(Boolean).join(" / ");
    const quantity = Math.max(Number(item.quantity) || 1, 1);
    return `<tr><td style="padding:9px 4px;border-bottom:1px solid #e9e5db">${escapeHtml(name)}${options ? ` <small>(${escapeHtml(options)})</small>` : ""} × ${quantity}</td><td style="padding:9px 4px;border-bottom:1px solid #e9e5db;text-align:right">${((Number(item.price) || 0) * quantity).toLocaleString()} XAF</td></tr>`;
  }).join("");
  const adminUrl = `${appUrl}/admin`;
  const htmlFor = (language: string) => {
    const text = copy[language];
    const payment = checkout.payment_status === "paid" ? (language === "fr" ? "Payé" : language === "zh" ? "已付款" : "Paid") : (language === "fr" ? "En attente de paiement" : language === "zh" ? "等待付款" : "Awaiting payment");
    return `<!doctype html><html lang="${language}"><body style="margin:0;padding:26px 12px;background:#f5f4ef;font-family:Arial,sans-serif;color:#29372f"><main style="max-width:600px;margin:auto;padding:28px;background:#fffefa;border:1px solid #e4e1d8"><p style="font-size:11px;letter-spacing:3px;color:#8c7554;font-weight:bold">TSOGO-BIS · ADMIN</p><h1 style="font:normal 26px Georgia,serif">${text.title}</h1><p><strong>${text.order} #${escapeHtml(checkout.checkout_id)}</strong></p><p>${text.customer}: ${escapeHtml(checkout.user_name)}<br>${text.email}: ${escapeHtml(checkout.email)}<br>${text.phone}: ${escapeHtml(checkout.phone_number)}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">${text.items}</th><th style="text-align:right">${text.total}</th></tr></thead><tbody>${rows}</tbody></table><p>${text.payment}: <strong>${payment}</strong></p><p>${text.total}: <strong>${Number(checkout.total || 0).toLocaleString()} XAF</strong></p>${Number(checkout.shipping_due_on_delivery) > 0 ? `<p>${text.shipping}: ${Number(checkout.shipping_due_on_delivery).toLocaleString()} XAF</p>` : ""}<p style="margin-top:24px"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:12px 18px;background:#1d332a;color:#fff;text-decoration:none">${text.open}</a></p></main></body></html>`;
  };

  for (const recipient of recipients) {
    const { error: claimError } = await admin.from("admin_new_order_email_log")
      .insert({ checkout_id: Number(checkout.checkout_id), recipient_email: recipient.email });
    if (claimError?.code === "23505") continue;
    if (claimError) {
      console.error("Could not claim new-order email notification:", claimError.message);
      continue;
    }
    const preferred = profileById.get(recipient.id);
    const language = ["en", "fr", "zh"].includes(preferred) ? preferred : "en";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: resendFrom, to: [recipient.email], subject: copy[language].subject, html: htmlFor(language) }),
      signal: AbortSignal.timeout(12000),
    }).catch((error) => {
      console.error("New-order email request failed:", recipient.email, error);
      return null;
    });
    if (!response?.ok) {
      const message = response ? await response.text().catch(() => "") : "network failure";
      console.error("New-order email was rejected:", recipient.email, response?.status, message);
      await admin.from("admin_new_order_email_log").delete()
        .eq("checkout_id", checkout.checkout_id).eq("recipient_email", recipient.email);
      continue;
    }
    await admin.from("admin_new_order_email_log").update({ sent_at: new Date().toISOString() })
      .eq("checkout_id", checkout.checkout_id).eq("recipient_email", recipient.email);
  }
}

async function notifyAdminsOfNewOrder(admin: any, checkout: any) {
  try {
    await notifyAdminsOfNewOrderSafely(admin, checkout);
  } catch (error) {
    console.error("Could not notify administrators about the new order:", error);
  }
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, headers);
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("Fapshi checkout environment is incomplete");
    return respond({ error: "Payment service is not configured" }, 503, headers);
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in to continue" }, 401, headers);
    const token = authorization.slice("Bearer ".length);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user?.id || !user.email) return respond({ error: "Your session is invalid. Sign in again." }, 401, headers);
    const { data: isAdmin, error: roleError } = await authClient.rpc("is_admin_role");
    if (roleError) {
      console.error("Could not verify checkout account role:", roleError.message);
      return respond({ error: "Could not verify account permissions. Please try again." }, 503, headers);
    }
    if (isAdmin === true) return respond({ error: "Administrator accounts cannot place customer orders." }, 403, headers);

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
      p_shipping_payment_mode: body.shippingPaymentMode === "online" ? "online" : "arrival",
    });
    if (checkoutError || !checkout) {
      const message = checkoutError?.message ?? "Unable to create checkout";
      const status = /stock|unavailable|cart items/i.test(message) ? 409 : /invalid|greater than zero/i.test(message) ? 400 : 500;
      console.error("Atomic checkout creation failed:", checkoutError?.code, message);
      return respond({ error: status === 409 ? "A selected product is out of stock or your cart changed. Refresh your bag and try again." : status === 400 ? message : "Could not create your checkout" }, status, headers);
    }
    const requestedEmailLanguage = typeof body.emailLanguage === "string" ? body.emailLanguage.slice(0, 2) : "";
    const { data: profileLanguage } = await admin.from("profiles").select("preferred_language")
      .eq("user_id", user.id).maybeSingle();
    const emailLanguage = ["en", "fr", "zh"].includes(requestedEmailLanguage)
      ? requestedEmailLanguage
      : ["en", "fr", "zh"].includes(profileLanguage?.preferred_language) ? profileLanguage.preferred_language : "fr";
    const { error: languageSaveError } = await admin.from("checkouts")
      .update({ email_language: emailLanguage }).eq("checkout_id", checkout.checkout_id);
    if (languageSaveError) {
      console.error("Could not save checkout email language:", languageSaveError.message);
      return respond({ error: "Could not save your email language preference. Please retry checkout." }, 500, headers);
    }
    const { data: persistedCheckout, error: persistedCheckoutError } = await admin.from("checkouts")
      .select("checkout_id,total,service_fee,amount_due,shipping_due_on_delivery,shipping_payment_mode,email_language,items,payment_status,payment_url,payment_reference")
      .eq("checkout_id", checkout.checkout_id).maybeSingle();
    if (persistedCheckoutError || !persistedCheckout) return respond({ error: "Could not load your order details." }, 500, headers);
    Object.assign(checkout, persistedCheckout);

    const { data: checkoutTotal, error: creditError } = await admin.rpc("apply_referral_store_credit", {
      p_checkout_id: Number(checkout.checkout_id),
      p_user_id: user.id,
      p_use_credit: body.useReferralCredit === true,
    });
    if (creditError || !checkoutTotal) {
      console.error("Could not apply referral store credit:", creditError?.message);
      return respond({ error: "Could not verify your store credit. Please retry checkout." }, 500, headers);
    }

    const isWhatsApp = body.paymentMode === "whatsapp";
    const existingFee = Number(checkout.service_fee) || 0;
    const subtotal = Math.max(0, (Number(checkout.total) || 0) - existingFee);
    const checkoutItems = Array.isArray(checkout.items) ? checkout.items : [];
    const merchandiseSubtotal = checkoutItems.reduce((sum: number, item: any) => sum + (Number(item.price) || 0) * Math.max(Number(item.quantity) || 1, 1), 0);
    const serviceFee = isWhatsApp ? 0 : existingFee || (merchandiseSubtotal > 100000 ? Math.round(merchandiseSubtotal * 0.03) : 0);
    const amountDue = Math.max(0, (Number(checkoutTotal.amount_due) || 0) - existingFee) + serviceFee;
    const { error: feeError } = await admin.from("checkouts").update({
      total: subtotal + serviceFee,
      service_fee: serviceFee,
      amount_due: amountDue,
      payment_method: isWhatsApp ? "WhatsApp — awaiting payment" : "Mobile Payment",
      payment_status: amountDue > 0 ? "pending" : "paid",
      status: amountDue > 0 ? "pending_payment" : "paid",
    }).eq("checkout_id", checkout.checkout_id);
    if (feeError) {
      console.error("Could not save checkout fee:", feeError.message);
      return respond({ error: "Could not save the final order amount. Please retry." }, 500, headers);
    }
    checkoutTotal.amount_due = amountDue;
    checkoutTotal.payment_status = amountDue > 0 ? "pending" : "paid";
    Object.assign(checkout, {
      total: subtotal + serviceFee,
      service_fee: serviceFee,
      amount_due: amountDue,
      payment_status: checkoutTotal.payment_status,
      shipping_due_on_delivery: checkout.shipping_due_on_delivery,
    });
    await notifyAdminsOfNewOrder(admin, checkout);

    if (amountDue <= 0) {
      return respond({ success: true, checkout_id: checkout.checkout_id, paymentUrl: null,
        reference: null, status: "paid", storeCreditApplied: checkoutTotal.referral_credit_applied }, 200, headers);
    }

    if (isWhatsApp) {
      return respond({ success: true, checkout_id: checkout.checkout_id, paymentUrl: null,
        reference: null, status: "awaiting_payment", amountDue, serviceFee,
        deliveryDueOnArrival: checkout.shipping_due_on_delivery }, 200, headers);
    }

    if (!apiKey || !apiUser) {
      console.error("Fapshi checkout environment is incomplete");
      return respond({ error: "Online payment is not configured. Use WhatsApp checkout instead." }, 503, headers);
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
      // An ambiguous timeout must not initiate a duplicate payment on retry.
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
        return respond({ error: "Fapshi rejected the API credentials. Confirm FAPSHI_API_USER and FAPSHI_API_KEY are from the same Fapshi service and environment as FAPSHI_BASE_URL." }, 502, headers);
      }
      return respond({ error: `Fapshi could not start this payment (${providerMessage}). No stock was deducted.` }, 502, headers);
    }

    const { error: updateError } = await admin.rpc("set_fapshi_checkout_payment", {
      p_checkout_id: String(checkout.checkout_id),
      p_payment_status: "CREATED",
      p_payment_reference: String(providerData.transId),
      p_payment_url: String(providerData.link),
    });
    if (updateError) {
      console.error("Could not persist Fapshi transaction:", updateError.message);
      // The provider has a valid link and may collect payment. Reconciliation can use externalId.
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

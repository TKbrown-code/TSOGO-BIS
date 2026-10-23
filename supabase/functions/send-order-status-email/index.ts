import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
const appUrl = (Deno.env.get("APP_URL") ?? "https://tsogo-bis.vercel.app").replace(/\/$/, "");

const translations: Record<string, Record<string, string>> = {
  en: { subject: "Order {{id}} update: {{status}}", title: "Your order has been updated", order: "Order", status: "Status", delivery: "Delivery status", track: "Track your order", note: "We’ll keep you informed as your order progresses." },
  fr: { subject: "Mise à jour de la commande {{id}} : {{status}}", title: "Votre commande a été mise à jour", order: "Commande", status: "Statut", delivery: "État de la livraison", track: "Suivre votre commande", note: "Nous vous tiendrons informé de l’avancement de votre commande." },
  zh: { subject: "订单 {{id}} 状态更新：{{status}}", title: "您的订单状态已更新", order: "订单", status: "状态", delivery: "配送状态", track: "追踪订单", note: "我们会继续向您发送订单进度。" },
};
const orderStatusLabels: Record<string, Record<string, string>> = {
  en: { pending: "Pending", pending_payment: "Awaiting payment", processing: "Processing", completed: "Completed", paid: "Paid", cancelled: "Cancelled", shipped: "Shipped", delivered: "Delivered", refunded: "Refunded" },
  fr: { pending: "En attente", pending_payment: "En attente de paiement", processing: "En préparation", completed: "Terminée", paid: "Payée", cancelled: "Annulée", shipped: "Expédiée", delivered: "Livrée", refunded: "Remboursée" },
  zh: { pending: "待处理", pending_payment: "等待付款", processing: "处理中", completed: "已完成", paid: "已付款", cancelled: "已取消", shipped: "已发货", delivered: "已送达", refunded: "已退款" },
};
const deliveryStatusLabels: Record<string, Record<string, string>> = {
  en: { pending: "Pending", processing: "Being prepared", in_transit: "In transit", out_for_delivery: "Out for delivery", delivered: "Delivered", failed: "Delivery failed", returned: "Returned" },
  fr: { pending: "En attente", processing: "En préparation", in_transit: "En transit", out_for_delivery: "En cours de livraison", delivered: "Livrée", failed: "Échec de livraison", returned: "Retournée" },
  zh: { pending: "待处理", processing: "正在准备", in_transit: "运输中", out_for_delivery: "正在派送", delivered: "已送达", failed: "配送失败", returned: "已退回" },
};
const escapeHtml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const respond = (body: unknown, status = 200, origin: string | null = null) => Response.json(body, {
  status,
  headers: {
    "Access-Control-Allow-Origin": origin && [appUrl, "http://localhost:5173", "http://127.0.0.1:5173"].includes(origin) ? origin : appUrl,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  },
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const reply = (body: unknown, status = 200) => respond(body, status, origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: respond({}, 200, origin).headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  if (!url || !anonKey || !serviceKey || !resendKey || !resendFrom) return reply({ error: "Order status email is not configured" }, 503);

  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in required" }, 401);
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await caller.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Session could not be verified" }, 401);
    const { data: isAdmin, error: roleError } = await caller.rpc("is_admin");
    if (roleError) return reply({ error: "Administrator access could not be verified; sign in again" }, 401);

    const body = await req.json().catch(() => null);
    const checkoutId = String(body?.checkoutId ?? "");
    const statusType = body?.statusType;
    const requestedStatus = body?.status;
    if (!/^\d+$/.test(checkoutId) || !["order", "delivery"].includes(statusType) || typeof requestedStatus !== "string") {
      return reply({ error: "Invalid order status notification" }, 400);
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: checkout, error: checkoutError } = await admin.from("checkouts")
      .select("checkout_id,user_id,user_name,email,status,delivery_status,tracking_number,tracking_link,email_language")
      .eq("checkout_id", checkoutId).maybeSingle();
    if (checkoutError || !checkout) return reply({ error: "Order not found" }, 404);

    const actualStatus = statusType === "delivery" ? checkout.delivery_status : checkout.status;
    if (actualStatus !== requestedStatus) return reply({ error: "Order status has changed; refresh and retry" }, 409);
    const isOwnerCancellation = statusType === "order" && actualStatus === "cancelled" && checkout.user_id === authData.user.id;
    if (statusType === "delivery" ? isAdmin !== true : isAdmin !== true && !isOwnerCancellation) {
      return reply({ error: "Administrator access required" }, 403);
    }
    if (!checkout.email) return reply({ error: "Customer email is missing for this order" }, 422);

    const { data: profile } = await admin.from("profiles").select("preferred_language").eq("user_id", checkout.user_id).maybeSingle();
    const language = [checkout.email_language, profile?.preferred_language, "fr"].find((item) => ["en", "fr", "zh"].includes(item)) as string;
    const labels = statusType === "delivery" ? deliveryStatusLabels : orderStatusLabels;
    const localizedStatus = labels[language][actualStatus] || actualStatus.replaceAll("_", " ");
    const copy = translations[language];
    const { data: claim, error: claimError } = await admin.from("checkout_status_email_log")
      .insert({ checkout_id: Number(checkoutId), status_type: statusType, status: actualStatus })
      .select("checkout_id").maybeSingle();
    if (claimError?.code === "23505") return reply({ success: true, sent: false, alreadySent: true });
    if (claimError || !claim) throw new Error(claimError?.message || "Could not claim status notification");

    const trackingUrl = checkout.tracking_link || (checkout.tracking_number ? `${appUrl}/track/${encodeURIComponent(checkout.tracking_number)}` : `${appUrl}/orders`);
    const subject = copy.subject.replace("{{id}}", String(checkoutId)).replace("{{status}}", localizedStatus);
    const heading = statusType === "delivery" ? copy.delivery : copy.status;
    const html = `<!doctype html><html lang="${language}"><body style="margin:0;padding:28px 14px;background:#f5f4ef;font-family:Arial,sans-serif;color:#29372f"><main style="max-width:560px;margin:auto;padding:30px;background:#fffefa;border:1px solid #e4e1d8"><p style="font-size:11px;letter-spacing:3px;color:#8c7554;font-weight:bold">TSOGO-BIS</p><h1 style="font:normal 27px Georgia,serif">${copy.title}</h1><p>${escapeHtml(checkout.user_name || "")}</p><p><strong>${copy.order} #${escapeHtml(checkoutId)}</strong></p><p>${heading}: <strong>${escapeHtml(localizedStatus)}</strong></p><p>${copy.note}</p><p style="margin-top:26px"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:13px 20px;background:#1d332a;color:#fff;text-decoration:none">${copy.track}</a></p></main></body></html>`;
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: resendFrom, to: [checkout.email], subject, html }),
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      await admin.from("checkout_status_email_log").delete().eq("checkout_id", checkoutId).eq("status_type", statusType).eq("status", actualStatus);
      throw error;
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      await admin.from("checkout_status_email_log").delete().eq("checkout_id", checkoutId).eq("status_type", statusType).eq("status", actualStatus);
      throw new Error(`Email provider rejected status notification (${response.status}): ${result?.message || "request failed"}`);
    }
    const { error: sentError } = await admin.from("checkout_status_email_log")
      .update({ sent_at: new Date().toISOString() }).eq("checkout_id", checkoutId).eq("status_type", statusType).eq("status", actualStatus);
    if (sentError) console.error("Status email sent but delivery log could not be updated:", sentError.message);
    return reply({ success: true, sent: true });
  } catch (error) {
    console.error("Could not send order status email:", error);
    return reply({ error: error instanceof Error ? error.message : "Could not send status email" }, 500);
  }
});

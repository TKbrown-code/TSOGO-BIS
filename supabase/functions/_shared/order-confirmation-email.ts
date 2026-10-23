const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const money = (value: unknown, language: string) => new Intl.NumberFormat(
  ({ en: "en-CM", fr: "fr-CM", zh: "zh-CN" } as Record<string, string>)[language] || "fr-CM",
  { style: "currency", currency: "XAF", maximumFractionDigits: 0 },
).format(Number(value) || 0);

const messages: Record<string, Record<string, string>> = {
  en: {
    subject: "Payment confirmed — order {{id}}", greeting: "Thank you for your order, {{name}}.",
    confirmed: "Your payment is confirmed. Here is your order summary and tracking link.", track: "Track your order",
    trackingNumber: "Tracking number", item: "ITEM", amount: "AMOUNT", shipping: "Shipping",
    noShipping: "No shipping fee was charged", paid: "Paid", unpaid: "Not paid", total: "Total paid",
    method: "Payment method", online: "Online payment", mobile: "Mobile payment", bank: "Bank payment", help: "If you need help with your order, reply to this email.",
  },
  fr: {
    subject: "Paiement confirmé — commande {{id}}", greeting: "Merci pour votre commande, {{name}}.",
    confirmed: "Votre paiement est confirmé. Voici le récapitulatif de votre commande et son lien de suivi.", track: "Suivre ma commande",
    trackingNumber: "Numéro de suivi", item: "ARTICLE", amount: "MONTANT", shipping: "Livraison",
    noShipping: "Aucun frais de livraison facturé", paid: "Payée", unpaid: "Non payée", total: "Total payé",
    method: "Mode de paiement", online: "Paiement en ligne", mobile: "Paiement mobile", bank: "Paiement bancaire", help: "Pour toute question concernant votre commande, répondez à cet e-mail.",
  },
  zh: {
    subject: "付款已确认 — 订单 {{id}}", greeting: "感谢您的订购，{{name}}。",
    confirmed: "您的付款已确认。以下是订单摘要和物流追踪链接。", track: "追踪订单",
    trackingNumber: "物流追踪号", item: "商品", amount: "金额", shipping: "配送",
    noShipping: "未收取配送费", paid: "已支付", unpaid: "未支付", total: "实付总额",
    method: "付款方式", online: "在线支付", mobile: "手机支付", bank: "银行转账", help: "如需订单帮助，请直接回复此邮件。",
  },
};

export async function sendOrderConfirmationEmail(admin: any, checkoutId: string | number) {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
  const appUrl = (Deno.env.get("APP_URL") ?? "https://tsogo-bis.vercel.app").replace(/\/$/, "");
  if (!apiKey || !from) throw new Error("Order email is not configured (RESEND_API_KEY or RESEND_FROM_EMAIL is missing)");

  const { data: checkout, error: checkoutError } = await admin.from("checkouts")
    .select("checkout_id,user_id,user_name,email,total,items,tracking_number,payment_status,payment_method")
    .eq("checkout_id", checkoutId).maybeSingle();
  if (checkoutError || !checkout) throw new Error(checkoutError?.message ?? "Checkout not found for confirmation email");
  if (checkout.payment_status !== "paid") return { sent: false, reason: "payment_not_paid" };
  if (!checkout.email || !checkout.tracking_number) throw new Error("Paid checkout is missing its email or tracking number");

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("preferred_language").eq("user_id", checkout.user_id).maybeSingle();
  if (profileError) console.error("Could not read email language preference:", profileError.message);
  const language = ["en", "fr", "zh"].includes(profile?.preferred_language) ? profile.preferred_language : "fr";
  const copy = messages[language];
  const formatMoney = (value: unknown) => money(value, language);

  const { data: claimed, error: claimError } = await admin.rpc("claim_order_confirmation_email", {
    p_checkout_id: checkout.checkout_id,
  });
  if (claimError) throw new Error(`Could not claim order confirmation email: ${claimError.message}`);
  if (!claimed) return { sent: false, reason: "already_sent_or_in_progress" };

  try {
    const items = Array.isArray(checkout.items) ? checkout.items : [];
    const shippingAmount = items.reduce((sum: number, item: any) =>
      sum + (Number(item?.shipping_fee) || 0) * Math.max(Number(item?.quantity) || 1, 1), 0);
    const rows = items.map((item: any) => {
      const name = String(item?.name || "Product");
      const quantity = Math.max(Number(item?.quantity) || 1, 1);
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #ece8df;color:#354239">${escapeHtml(name)} <span style="color:#85877f">× ${quantity}</span></td><td style="padding:12px 0;border-bottom:1px solid #ece8df;text-align:right;white-space:nowrap;color:#26352e">${formatMoney((Number(item?.price) || 0) * quantity)}</td></tr>`;
    }).join("");
    const trackingUrl = `${appUrl}/track/${encodeURIComponent(checkout.tracking_number)}`;
    const shippingStatus = shippingAmount <= 0 ? copy.noShipping : checkout.payment_status === "paid" ? copy.paid : copy.unpaid;
    const greeting = copy.greeting.replace("{{name}}", escapeHtml(checkout.user_name || "Customer"));
    const subject = copy.subject.replace("{{id}}", String(checkout.checkout_id));
    const rawPaymentMethod = String(checkout.payment_method || "").toLowerCase();
    const paymentMethod = rawPaymentMethod.includes("bank") ? copy.bank
      : rawPaymentMethod.includes("mobile") || rawPaymentMethod.includes("fapshi") ? copy.mobile
        : copy.online;
    const html = `<!doctype html><html lang="${language}"><body style="margin:0;padding:28px 14px;background:#f5f4ef;font-family:Arial,sans-serif;color:#29372f"><table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background:#fffefa;border:1px solid #e4e1d8;padding:30px"><tr><td><p style="font-size:11px;letter-spacing:3px;color:#8c7554;font-weight:bold">TSOGO-BIS</p><h1 style="font:normal 28px Georgia,serif;margin:20px 0 8px">${greeting}</h1><p style="font-size:14px;line-height:1.7;color:#687168">${copy.confirmed}</p><p style="margin:24px 0"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#26372f;color:#fffefa;text-decoration:none;padding:13px 20px;font-size:13px;font-weight:bold">${copy.track}</a></p><p style="font-size:12px;color:#687168">${copy.trackingNumber}: <strong style="color:#26352e">${escapeHtml(checkout.tracking_number)}</strong></p><table role="presentation" style="width:100%;border-collapse:collapse;margin-top:24px"><thead><tr><th style="padding:10px 0;border-bottom:1px solid #dcd7ca;text-align:left;font-size:11px;color:#85877f">${copy.item}</th><th style="padding:10px 0;border-bottom:1px solid #dcd7ca;text-align:right;font-size:11px;color:#85877f">${copy.amount}</th></tr></thead><tbody>${rows}</tbody></table><table role="presentation" style="width:100%;margin-top:12px;font-size:13px"><tr><td style="padding:6px 0;color:#687168">${copy.shipping}</td><td style="padding:6px 0;text-align:right;color:#26352e">${formatMoney(shippingAmount)} · ${shippingStatus}</td></tr><tr><td style="padding:8px 0;border-top:1px solid #dcd7ca;font-weight:bold">${copy.total}</td><td style="padding:8px 0;border-top:1px solid #dcd7ca;text-align:right;font-weight:bold">${formatMoney(checkout.total)}</td></tr></table><p style="margin-top:26px;font-size:11px;line-height:1.6;color:#85877f">${copy.method}: ${paymentMethod}<br>${copy.help}</p></td></tr></table></body></html>`;
    const textItems = items.map((item: any) => `- ${String(item?.name || "Product")} × ${Math.max(Number(item?.quantity) || 1, 1)}: ${formatMoney((Number(item?.price) || 0) * Math.max(Number(item?.quantity) || 1, 1))}`).join("\n");
    const text = `${greeting}\n\n${copy.confirmed}\n${copy.trackingNumber}: ${checkout.tracking_number}\n${copy.track}: ${trackingUrl}\n\n${copy.item}:\n${textItems}\n\n${copy.shipping}: ${formatMoney(shippingAmount)} — ${shippingStatus}\n${copy.total}: ${formatMoney(checkout.total)}\n${copy.method}: ${paymentMethod}\n${copy.help}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `checkout-confirmation/${checkout.checkout_id}` },
      body: JSON.stringify({ from, to: [checkout.email], subject, html, text }),
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Resend rejected order email (${response.status}): ${result?.message ?? "request failed"}`);
    const { error: finishError } = await admin.rpc("finish_order_confirmation_email", { p_checkout_id: checkout.checkout_id, p_error: null });
    if (finishError) throw new Error(`Email sent but delivery state could not be saved: ${finishError.message}`);
    return { sent: true, emailId: result?.id ?? null };
  } catch (error) {
    await admin.rpc("finish_order_confirmation_email", {
      p_checkout_id: checkout.checkout_id,
      p_error: String(error instanceof Error ? error.message : error),
    });
    throw error;
  }
}

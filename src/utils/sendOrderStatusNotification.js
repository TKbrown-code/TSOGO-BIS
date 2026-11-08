import { supabase } from "../lib/supabase";

/**
 * Sends an order/delivery status email and reports what actually happened.
 * The edge function de-duplicates notifications per (checkout, status type,
 * status), so a successful call does not always mean a new email was sent.
 *
 * @returns {Promise<{ error: string|null, sent: boolean, alreadySent: boolean }>}
 */
export async function sendOrderStatusNotificationDetailed(checkoutId, statusType, status) {
  let data;
  let error;
  try {
    const response = await supabase.functions.invoke("send-order-status-email", {
      body: { checkoutId, statusType, status },
    });
    data = response.data;
    error = response.error;
  } catch (invokeError) {
    return {
      error: invokeError?.message || "The notification email could not be sent.",
      sent: false,
      alreadySent: false,
    };
  }
  if ([401, 403].includes(error?.context?.status)) {
    await supabase.auth.signOut({ scope: "local" });
  }
  if (error) {
    return {
      error: error.message || "The notification email could not be sent.",
      sent: false,
      alreadySent: false,
    };
  }
  if (!data?.success) {
    return {
      error: data?.error || "The notification email could not be sent.",
      sent: false,
      alreadySent: false,
    };
  }
  return {
    error: null,
    sent: data.sent !== false,
    alreadySent: data.alreadySent === true || data.sent === false,
  };
}

/** Backwards-compatible helper: returns an error message or null. */
export async function sendOrderStatusNotification(checkoutId, statusType, status) {
  const result = await sendOrderStatusNotificationDetailed(checkoutId, statusType, status);
  return result.error;
}

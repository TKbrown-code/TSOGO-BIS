import { supabase } from "../lib/supabase";

export async function sendOrderStatusNotification(checkoutId, statusType, status) {
  const { data, error } = await supabase.functions.invoke("send-order-status-email", {
    body: { checkoutId, statusType, status },
  });
  if ([401, 403].includes(error?.context?.status)) {
    await supabase.auth.signOut({ scope: "local" });
  }
  if (error) return error.message || "The notification email could not be sent.";
  if (!data?.success) return data?.error || "The notification email could not be sent.";
  return null;
}

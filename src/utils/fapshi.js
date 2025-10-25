// utils/fapshi.js
// Small helper to call the server-side Supabase function that creates a Campay/Fapshi order.
// This file should export plain async functions (not React components).

export async function verifyCampayPayment({ reference, checkout_id }) {
  if (!reference && !checkout_id) throw new Error("verifyCampayPayment: reference or checkout_id is required");

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://gidifmqzolmrqpywpimw.supabase.co";
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY;
  const X_WEBHOOK_SECRET = import.meta.env.VITE_X_WEBHOOK_SECRET;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  // Only include the webhook secret header if it exists. Not recommended for production.
  if (X_WEBHOOK_SECRET) {
    headers["x-webhook-secret"] = X_WEBHOOK_SECRET;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-campay-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reference, checkout_id }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const message = data?.error || `Payment verification failed (status ${res.status})`;
    throw new Error(message);
  }

  return data;
}

export default verifyCampayPayment;

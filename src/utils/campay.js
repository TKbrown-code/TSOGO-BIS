// utils/campay.js
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY;
const CAMPAY_API_URL = import.meta.env.VITE_CAMPAY_API_URL || 'https://ebnjqpqegwmbalufhpqk.supabase.co/functions/v1/create-campay-order';

export async function createCampayOrder(payload) {
  const url = CAMPAY_API_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
     'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }

  return res.json();
}

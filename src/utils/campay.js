// utils/campay.js
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY;

export async function createCampayOrder(payload) {
  const url = 'https://ebnjqpqegwmbalufhpqk.supabase.co/functions/v1/create-campay-order';
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

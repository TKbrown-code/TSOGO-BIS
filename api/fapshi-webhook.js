// File: /api/fapshi-webhook.js
// Proxy webhook from Fapshi → Supabase Edge Function
// Ensures a valid Supabase authorization header

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl =
      "https://gidifmqzolmrqpywpimw.supabase.co/functions/v1/verify-campay-payment";

    // ✅ Inject your Supabase Service Role key directly
    const resp = await fetch(supabaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, // <-- This is the fix
      },
      body: JSON.stringify(req.body),
    });

    const responseText = await resp.text();
    console.log("✅ Forwarded webhook:", { status: resp.status, response: responseText });

    res.status(resp.status).send(responseText);
  } catch (error) {
    console.error("❌ Webhook proxy error:", error);
    res.status(500).json({
      error: "Webhook proxy failed",
      details: error.message,
    });
  }
}

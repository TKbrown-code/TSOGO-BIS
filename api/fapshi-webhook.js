// Vercel API Route: /api/fapshi-webhook.js
// This acts as a proxy to forward Fapshi webhooks to Supabase
// to avoid TLS certificate issues with payment gateways

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Supabase Edge Function URL
    const supabaseUrl = "https://gidifmqzolmrqpywpimw.supabase.co/functions/v1/verify-campay-payment";

    // Forward the request to Supabase
    const resp = await fetch(supabaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward important headers
        "x-webhook-secret": req.headers["x-webhook-secret"] || "",
        "Authorization": req.headers["authorization"] || "",
        "User-Agent": req.headers["user-agent"] || "",
      },
      body: JSON.stringify(req.body),
    });

    // Get response data
    const responseText = await resp.text();

    // Forward the status and response back to Fapshi
    res.status(resp.status).send(responseText);

  } catch (error) {
    console.error("Webhook proxy error:", error);
    res.status(500).json({
      error: "Webhook proxy failed",
      details: error.message
    });
  }
}

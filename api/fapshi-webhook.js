// File: /api/fapshi-webhook.js
// Vercel API route that proxies Fapshi webhooks to Supabase Edge Function

export const config = {
  api: {
    bodyParser: false, // 👈 disable automatic parsing
  },
};

export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw body as text
    const rawBody = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    // Parse JSON safely
    let jsonBody;
    try {
      jsonBody = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    // 🔗 Supabase Edge Function URL
    const supabaseUrl = "https://gidifmqzolmrqpywpimw.supabase.co/functions/v1/verify-campay-payment";

    // ✅ Forward to Supabase Edge Function
    const resp = await fetch(supabaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Optionally include your own secret if you want double protection
        "x-proxy-secret": process.env.VERCEL_PROXY_SECRET || "",
      },
      body: JSON.stringify(jsonBody),
    });

    const responseText = await resp.text();

    console.log("✅ Forwarded webhook:", {
      status: resp.status,
      response: responseText,
    });

    // Send response back to Fapshi
    res.status(resp.status).send(responseText);
  } catch (error) {
    console.error("❌ Webhook proxy error:", error);
    res.status(500).json({
      error: "Webhook proxy failed",
      details: error.message,
    });
  }
}

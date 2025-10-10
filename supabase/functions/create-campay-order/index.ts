import { createClient } from "npm:@supabase/supabase-js@2.33.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const CAMPAY_API_KEY = Deno.env.get("CAMPAY_API_KEY") ?? "";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables.");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false
  }
});
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey"
    }
  });
}
function badRequest(msg = "Bad Request") {
  return jsonResponse({
    error: msg
  }, 400);
}
const _originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init)=>{
  try {
    const providedSignal = init?.signal;
    let controller;
    let timeoutId;
    if (!providedSignal) {
      controller = new AbortController();
      init = {
        ...init ?? {},
        signal: controller.signal
      };
      timeoutId = setTimeout(()=>controller.abort(), 10000);
    }
    const res = await _originalFetch(input, init);
    if (timeoutId) clearTimeout(timeoutId);
    return res;
  } catch (err) {
    console.error("fetch wrapper caught error:", err);
    const body = {
      detail: "Network error contacting external service",
      error: String(err)
    };
    return new Response(JSON.stringify(body), {
      status: 502,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
};
function serverError(msg = "Internal Server Error") {
  return jsonResponse({
    error: msg
  }, 500);
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey"
      }
    });
  }
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return badRequest("Content-Type must be application/json");
    const body = await req.json().catch(()=>null);
    if (!body) return badRequest("Invalid JSON body");
    const { name, phone, address, total, items, userId } = body;
    if (typeof name !== "string" || !name.trim()) return badRequest("Missing or invalid 'name'");
    if (!phone) return badRequest("Missing 'phone'");
    if (typeof address !== "string" || !address.trim()) return badRequest("Missing or invalid 'address'");
    if (typeof total !== "number" || total <= 0) return badRequest("Missing or invalid 'total'");
    if (!Array.isArray(items) || items.length === 0) return badRequest("Missing or invalid 'items'");
    // Save checkout
    const { data: checkoutData, error: checkoutError } = await supabase.from("checkouts").insert({
      user_name: name,
      phone_number: String(phone),
      user_id: userId,
      address,
      total
    }).select().single();
    if (checkoutError || !checkoutData) {
      console.error("DB checkout insert error:", checkoutError);
      return serverError("Failed to create checkout");
    }
    const checkoutId = checkoutData.checkout_id;
    if (!checkoutId) return serverError("Failed to create checkout (no id)");
    // Ensure CamPay key present
    if (!CAMPAY_API_KEY) {
      console.error("Missing CAMPAY_API_KEY");
      return serverError("Payment provider configuration missing");
    }
    // Choose endpoint according to token (demo vs prod). Use the one matching your token.
    // For Edge Function testing, use the demo endpoint always
    const campayEndpoint = "https://demo.campay.net/api/collect/";
    const campayPayload = {
      amount: String(total),
      currency: "XAF",
      from: String(phone),
      description: `Checkout #${checkoutId}`,
      external_reference: "",
      external_user: ""
    };
    const campayRes = await fetch(campayEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Token ${CAMPAY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(campayPayload)
    });
    const campayData = await campayRes.json().catch(()=>null);
    if (!campayRes.ok || !campayData) {
      console.error("CamPay error:", campayRes.status, campayData);
      return serverError(campayData?.detail || campayData?.message || "Payment provider request failed");
    }
    return jsonResponse({
      success: true,
      paymentUrl: campayData.link ?? null,
      reference: campayData.reference ?? campayData.reference_id ?? null,
      checkout_id: checkoutId
    }, 200);
  } catch (err) {
    console.error("Unhandled error:", err);
    return serverError(err?.message ?? "Unhandled error");
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.33.0";
serve(async (req)=>{
  // --- Handle CORS preflight ---
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-webhook-secret"
      }
    });
  }
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (secret !== Deno.env.get("WEBHOOK_SECRET")) {
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const { reference, checkout_id } = await req.json().catch(()=>({}));
    if (!reference || !checkout_id) {
      return new Response(JSON.stringify({
        error: "Missing reference or checkout_id"
      }), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // --- Call CamPay API (GET request) ---
    const campayRes = await fetch(`https://demo.campay.net/api/transaction/${reference}/`, {
      method: "GET",
      headers: {
        "Authorization": `Token ${Deno.env.get("CAMPAY_API_KEY")}`,
        "Content-Type": "application/json"
      }
    });
    const result = await campayRes.json().catch(()=>null);
    if (!campayRes.ok || !result) {
      console.error("CamPay verification failed:", campayRes.status, result);
      return new Response(JSON.stringify({
        error: result?.message || "Failed to verify payment"
      }), {
        status: 502,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // --- Map CamPay status ---
    let status = "pending";
    switch(result.status){
      case "SUCCESSFUL":
        status = "paid";
        break;
      case "FAILED":
        status = "failed";
        break;
      case "PENDING":
      default:
        status = "pending";
    }
    // --- Update Supabase checkout ---
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SERVICE_ROLE_KEY"));
    const { error } = await supabase.from("checkouts").update({
      status
    }).eq("checkout_id", checkout_id);
    if (error) {
      console.error("Supabase update error:", error);
      return new Response(JSON.stringify({
        error: "Failed to update checkout status"
      }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // --- Success response ---
    return new Response(JSON.stringify({
      success: true,
      checkout_id,
      status
    }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({
      error: err?.message || "Unhandled error"
    }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});

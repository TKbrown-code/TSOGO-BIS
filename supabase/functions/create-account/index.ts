import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
const rateLimitSecret = Deno.env.get("RESET_RATE_LIMIT_SECRET") ?? "";
const allowedOrigins = new Set(
  [appUrl, "http://localhost:5173", "http://127.0.0.1:5173", ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => { try { return new URL(value).origin; } catch { return ""; } })
    .filter(Boolean),
);

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const copy: Record<string, Record<string, string>> = {
  en: { subject: "Confirm your TSOGO-BIS account", title: "Confirm your email address", greeting: "Hello {{name}},", intro: "Thanks for creating a TSOGO-BIS account. Confirm your email address to access your account and follow your orders.", action: "Confirm email address", ignore: "If you didn’t create this account, you can ignore this email." },
  fr: { subject: "Confirmez votre compte TSOGO-BIS", title: "Confirmez votre adresse e-mail", greeting: "Bonjour {{name}},", intro: "Merci d’avoir créé un compte TSOGO-BIS. Confirmez votre adresse e-mail pour accéder à votre compte et suivre vos commandes.", action: "Confirmer mon adresse e-mail", ignore: "Si vous n’avez pas créé ce compte, vous pouvez ignorer cet e-mail." },
  zh: { subject: "确认您的 TSOGO-BIS 账户", title: "确认您的电子邮件地址", greeting: "您好，{{name}}：", intro: "感谢您创建 TSOGO-BIS 账户。请确认您的电子邮件地址，以便使用账户并追踪订单。", action: "确认电子邮件地址", ignore: "如果您没有创建此账户，请忽略此邮件。" },
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

function decodeReferralToken(value: unknown) {
  if (typeof value !== "string") return null;
  const [encoded, suffix, ...rest] = value.split(".");
  if (!encoded || !suffix || rest.length || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-F0-9]{7}$/i.test(suffix)) return null;
  try {
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded)) return null;
    if (decoded.replaceAll("-", "").slice(0, 7).toUpperCase() !== suffix.toUpperCase()) return null;
    return decoded.toLowerCase();
  } catch {
    return null;
  }
}

function headers(origin: string) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    Vary: "Origin",
  };
}

function respond(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

async function hashBucket(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(rateLimitSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function allowAttempt(bucket: string) {
  const bucketHash = await hashBucket(bucket);
  const { data, error } = await supabase!.rpc("consume_password_reset_rate_limit", { p_bucket_hash: bucketHash });
  if (error) throw error;
  return data === true;
}

Deno.serve(async (request: Request) => {
  let origin = "";
  try { origin = new URL(request.headers.get("Origin") ?? "").origin; } catch { /* no valid origin */ }
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return new Response("Forbidden", { status: 403 });
    return new Response("ok", { headers: headers(origin) });
  }
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405, origin || "null");
  if (!origin || !allowedOrigins.has(origin)) return respond({ error: "Origin not allowed" }, 403, origin || "null");
  if (!supabase || !resendApiKey || !resendFrom || !appUrl || !rateLimitSecret) {
    console.error("Account creation email function is missing required configuration");
    return respond({ error: "Account creation is temporarily unavailable" }, 503, origin);
  }

  let body: { action?: unknown; email?: unknown; password?: unknown; fullName?: unknown; language?: unknown; referralCode?: unknown };
  try { body = await request.json(); } catch { return respond({ error: "Invalid request" }, 400, origin); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const language = typeof body.language === "string" && ["en", "fr", "zh"].includes(body.language) ? body.language : "fr";
  const isResendConfirmation = body.action === "resend_confirmation";
  const referrerUserId = decodeReferralToken(body.referralCode);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: "Enter a valid email address" }, 400, origin);
  if (!isResendConfirmation && (password.length < 6 || password.length > 72)) return respond({ error: "Password must be between 6 and 72 characters" }, 400, origin);
  if (!isResendConfirmation && (!fullName || fullName.length > 120)) return respond({ error: "Enter a valid name" }, 400, origin);

  const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  let createdUserId: string | null = null;
  try {
    const allowedByIp = await allowAttempt(`signup:ip:${clientIp}`);
    const allowedByEmail = await allowAttempt(`signup:email:${email}`);
    if (!allowedByIp || !allowedByEmail) {
      return respond({ success: true, message: "If this address can be registered, a confirmation email will arrive shortly." }, 200, origin);
    }
  } catch (error) {
    console.error("Signup rate limit check failed:", error);
    return respond({ error: "Account creation is temporarily unavailable" }, 503, origin);
  }

  if (isResendConfirmation) {
    try {
      let pendingUser = null;
      for (let page = 1; !pendingUser; page += 1) {
        const { data: usersPage, error: usersError } = await supabase!.auth.admin.listUsers({ page, perPage: 1000 });
        if (usersError) throw usersError;
        pendingUser = usersPage.users.find((user) => user.email?.toLowerCase() === email) ?? null;
        if (pendingUser || usersPage.users.length < 1000) break;
      }
      // Keep the endpoint's response identical for unknown or already verified addresses.
      if (!pendingUser || pendingUser.email_confirmed_at) {
        return respond({ success: true, message: "If this account still needs verification, another email will arrive shortly." }, 200, origin);
      }

      // For an existing unconfirmed user, generateLink rotates the confirmation
      // token without changing the user's password. The password is ignored for
      // an existing account by GoTrue; it is only required by the SDK type.
      const { data: linkData, error: linkError } = await supabase!.auth.admin.generateLink({
        type: "signup",
        email,
        password: `Resend-${crypto.randomUUID()}-Aa1!`,
        options: { redirectTo: new URL("/", appUrl).toString() },
      });
      if (linkError || !linkData?.properties?.action_link) throw linkError ?? new Error("Confirmation link was not generated");
      const actionLink = new URL(linkData.properties.action_link);
      if (actionLink.origin !== new URL(supabaseUrl).origin) throw new Error("Unexpected confirmation link origin");
      const message = copy[language];
      const greeting = message.greeting.replace("{{name}}", escapeHtml(pendingUser.user_metadata?.display_name ?? ""));
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `signup-resend/${pendingUser.id}/${linkData.properties.hashed_token ?? Date.now()}`,
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [email],
          subject: message.subject,
          html: `<!doctype html><html lang="${language}"><body style="margin:0;padding:32px 16px;background:#f5f4ef;font-family:Arial,sans-serif;color:#29372f"><table role="presentation" style="max-width:560px;margin:0 auto;background:#fffefa;border:1px solid #e4e1d8;padding:36px;width:100%"><tr><td><p style="font-size:11px;letter-spacing:3px;color:#8c7554;font-weight:bold">TSOGO-BIS</p><h1 style="font:normal 30px Georgia,serif;margin:26px 0 12px">${message.title}</h1><p style="font-size:14px;line-height:1.7;color:#687168">${greeting}<br>${message.intro}</p><p style="margin:28px 0"><a href="${escapeHtml(actionLink.toString())}" style="display:inline-block;background:#26372f;color:#fffefa;text-decoration:none;padding:14px 22px;font-size:13px;font-weight:bold">${message.action}</a></p><p style="font-size:12px;line-height:1.6;color:#7b8179">${message.ignore}</p></td></tr></table></body></html>`,
          text: `${message.title}\n\n${greeting}\n${message.intro}\n\n${message.action}: ${actionLink}\n\n${message.ignore}`,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const resendResult = await response.json().catch(() => null);
      if (!response.ok) {
        console.error("Resend rejected signup confirmation retry:", response.status, resendResult?.message ?? "request failed");
        return respond({ error: "The confirmation email could not be sent. Please try again later." }, 502, origin);
      }
      return respond({ success: true, message: "If this account still needs verification, another email will arrive shortly." }, 200, origin);
    } catch (error) {
      console.error("Signup confirmation resend failed:", error);
      return respond({ error: "The confirmation email could not be sent. Please try again later." }, 502, origin);
    }
  }

  try {
    const redirectTo = new URL("/", appUrl).toString();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        redirectTo,
        data: { display_name: fullName, preferred_language: language },
      },
    });
    if (error) {
      if (/already registered|already been registered|user exists/i.test(error.message)) {
        return respond({ success: true, account_exists: true }, 200, origin);
      }
      console.error("Could not create signup confirmation link:", error.message);
      return respond({ error: "Account creation is temporarily unavailable" }, 503, origin);
    }
    createdUserId = data?.user?.id ?? null;
    if (!data?.properties?.action_link || !createdUserId) {
      console.error("Signup confirmation link response was incomplete");
      throw new Error("Signup confirmation link response was incomplete");
    }

    if (referrerUserId && referrerUserId !== createdUserId) {
      // The referral FK targets profiles.user_id. Repair a missing profile for
      // an existing Auth user (for example, an account created before the
      // profile trigger was installed) before recording the attribution.
      const { data: referrerData, error: referrerError } = await supabase.auth.admin.getUserById(referrerUserId);
      if (referrerError || !referrerData.user) {
        console.warn("Referral link points to a missing Auth user; continuing signup without attribution:", {
          referrer_user_id: referrerUserId,
          message: referrerError?.message ?? "Auth user not found",
        });
      } else {
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            user_id: referrerUserId,
            display_name: String(referrerData.user.user_metadata?.display_name ?? "") || null,
          },
          { onConflict: "user_id", ignoreDuplicates: true },
        );
        if (profileError) {
          console.error("Could not ensure the referral owner's profile exists:", {
            referrer_user_id: referrerUserId,
            code: profileError.code,
            message: profileError.message,
          });
        } else {
          const { error: referralError } = await supabase.from("referrals").insert({
            referrer_user_id: referrerUserId,
            referred_user_id: createdUserId,
            // Referral URLs use an opaque user-id token, not the optional
            // human-readable profile referral_code column.
            referral_code: String(body.referralCode),
          });
          if (referralError && referralError.code !== "23505") {
            console.error("Referral attribution could not be saved; continuing signup:", {
              referrer_user_id: referrerUserId,
              referred_user_id: createdUserId,
              code: referralError.code,
              message: referralError.message,
            });
          } else if (!referralError) {
            console.info("Referral attribution saved", { referrer_user_id: referrerUserId, referred_user_id: createdUserId });
          }
        }
      }
    }

    const actionLink = new URL(data.properties.action_link);
    if (actionLink.origin !== new URL(supabaseUrl).origin) throw new Error("Unexpected confirmation link origin");
    const message = copy[language];
    const greeting = message.greeting.replace("{{name}}", escapeHtml(fullName));
    const html = `<!doctype html><html lang="${language}"><body style="margin:0;padding:32px 16px;background:#f5f4ef;font-family:Arial,sans-serif;color:#29372f"><table role="presentation" style="max-width:560px;margin:0 auto;background:#fffefa;border:1px solid #e4e1d8;padding:36px;width:100%"><tr><td><p style="font-size:11px;letter-spacing:3px;color:#8c7554;font-weight:bold">TSOGO-BIS</p><h1 style="font:normal 30px Georgia,serif;margin:26px 0 12px">${message.title}</h1><p style="font-size:14px;line-height:1.7;color:#687168">${greeting}<br>${message.intro}</p><p style="margin:28px 0"><a href="${escapeHtml(actionLink.toString())}" style="display:inline-block;background:#26372f;color:#fffefa;text-decoration:none;padding:14px 22px;font-size:13px;font-weight:bold">${message.action}</a></p><p style="font-size:12px;line-height:1.6;color:#7b8179">${message.ignore}</p></td></tr></table></body></html>`;
    const text = `${message.title}\n\n${greeting}\n${message.intro}\n\n${message.action}: ${actionLink}\n\n${message.ignore}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `signup-confirmation/${createdUserId}/${data.properties.hashed_token ?? Date.now()}`,
      },
      body: JSON.stringify({ from: resendFrom, to: [email], subject: message.subject, html, text }),
      signal: AbortSignal.timeout(12000),
    });
    const resendResult = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("Resend rejected signup confirmation:", response.status, resendResult?.message ?? "request failed");
      // Remove the unconfirmed user so the address can retry registration cleanly.
      const { error: deleteError } = await supabase.auth.admin.deleteUser(createdUserId);
      if (deleteError) console.error("Could not clean up signup after email failure:", deleteError.message);
      else createdUserId = null;
      return respond({ error: "The confirmation email could not be sent. Please try again later." }, 502, origin);
    }
    return respond({ success: true, message: "If this address can be registered, a confirmation email will arrive shortly." }, 200, origin);
  } catch (error) {
    console.error("Signup confirmation failed:", error);
    if (createdUserId) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(createdUserId);
      if (deleteError) console.error("Could not clean up signup after email failure:", deleteError.message);
    }
    return respond({ error: "The confirmation email could not be sent. Please try again later." }, 502, origin);
  }
});

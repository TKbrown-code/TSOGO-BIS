import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
const appUrl = Deno.env.get("APP_URL") ?? "";
const rateLimitSecret = Deno.env.get("RESET_RATE_LIMIT_SECRET") ?? "";
const resetCopy: Record<string, Record<string, string>> = {
  en: { subject: "Reset your TSOGO-BIS password", title: "Reset your password", intro: "We received a request to reset the password for your account. Use the button below to choose a new password.", action: "Choose a new password", ignore: "If you didn’t request this, you can ignore this email. The link will expire according to the account security settings.", textTitle: "Reset your TSOGO-BIS password", textAction: "Open this secure link to choose a new password:", textIgnore: "If you did not request a reset, you can ignore this email." },
  fr: { subject: "Réinitialiser votre mot de passe TSOGO-BIS", title: "Réinitialisation du mot de passe", intro: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte. Utilisez le bouton ci-dessous pour en choisir un nouveau.", action: "Choisir un nouveau mot de passe", ignore: "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail. Le lien expirera selon les paramètres de sécurité du compte.", textTitle: "Réinitialiser votre mot de passe TSOGO-BIS", textAction: "Ouvrez ce lien sécurisé pour choisir un nouveau mot de passe :", textIgnore: "Si vous n’avez pas demandé la réinitialisation, ignorez cet e-mail." },
  zh: { subject: "重置您的 TSOGO-BIS 密码", title: "重置密码", intro: "我们收到重置账户密码的请求。请点击下方按钮设置新密码。", action: "设置新密码", ignore: "如果您没有请求重置密码，请忽略此邮件。链接将根据账户安全设置过期。", textTitle: "重置您的 TSOGO-BIS 密码", textAction: "打开此安全链接以设置新密码：", textIgnore: "如果您没有请求重置密码，请忽略此邮件。" },
};
const allowedOrigins = new Set(
  [appUrl, ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try { return new URL(value).origin; } catch { return ""; }
    })
    .filter(Boolean),
);

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function corsHeaders(origin: string) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}

function respond(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

async function hashRateLimitKey(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(rateLimitSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

Deno.serve(async (request: Request) => {
  const requestOrigin = request.headers.get("Origin") ?? "";
  let origin = "";
  try { origin = new URL(requestOrigin).origin; } catch { /* no browser origin */ }

  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return new Response("Forbidden", { status: 403 });
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405, origin || "null");
  if (!origin || !allowedOrigins.has(origin)) return respond({ error: "Origin not allowed" }, 403, origin || "null");
  if (!supabase || !resendApiKey || !resendFrom || !appUrl || !rateLimitSecret) {
    console.error("Password reset email function is missing required configuration");
    return respond({ error: "Password reset is temporarily unavailable" }, 503, origin);
  }

  let appBase: URL;
  try { appBase = new URL(appUrl); } catch {
    return respond({ error: "APP_URL is not a valid URL" }, 500, origin);
  }
  if (appBase.protocol !== "https:" && appBase.hostname !== "localhost") {
    return respond({ error: "APP_URL must use HTTPS" }, 500, origin);
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = request.headers.get("cf-connecting-ip") || forwardedFor || "unknown";
  try {
    const ipHash = await hashRateLimitKey(`ip:${clientIp}`);
    const { data: allowed, error: rateLimitError } = await supabase.rpc("consume_password_reset_rate_limit", { p_bucket_hash: ipHash });
    if (rateLimitError) {
      console.error("Password reset rate limit check failed:", rateLimitError.message);
      return respond({ error: "Password reset is temporarily unavailable" }, 503, origin);
    }
    if (allowed !== true) {
      return respond({ message: "If an account exists for this email, a password reset link will arrive shortly." }, 200, origin);
    }
  } catch (error) {
    console.error("Password reset rate limit check failed:", error);
    return respond({ error: "Password reset is temporarily unavailable" }, 503, origin);
  }

  let body: { email?: unknown; language?: unknown };
  try { body = await request.json(); } catch { return respond({ error: "Invalid request" }, 400, origin); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const requestedLanguage = typeof body.language === "string" && ["en", "fr", "zh"].includes(body.language) ? body.language : "fr";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: "Enter a valid email address" }, 400, origin);
  }

  try {
    const emailHash = await hashRateLimitKey(`email:${email}`);
    const { data: allowed, error: rateLimitError } = await supabase.rpc("consume_password_reset_rate_limit", { p_bucket_hash: emailHash });
    if (rateLimitError) {
      console.error("Password reset email limit check failed:", rateLimitError.message);
      return respond({ error: "Password reset is temporarily unavailable" }, 503, origin);
    }
    if (allowed !== true) {
      return respond({ message: "If an account exists for this email, a password reset link will arrive shortly." }, 200, origin);
    }
  } catch (error) {
    console.error("Password reset email limit check failed:", error);
    return respond({ error: "Password reset is temporarily unavailable" }, 503, origin);
  }

  try {
    const redirectTo = new URL("/reset-password", appBase.origin).toString();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    // Keep account existence private; callers always receive the same success response.
    if (!error && data.properties?.action_link) {
      let language = requestedLanguage;
      if (data.user?.id) {
        const { data: profile, error: profileError } = await supabase.from("profiles")
          .select("preferred_language").eq("user_id", data.user.id).maybeSingle();
        if (profileError) console.error("Could not read password reset language preference:", profileError.message);
        if (profile?.preferred_language && ["en", "fr", "zh"].includes(profile.preferred_language)) {
          language = profile.preferred_language;
        }
      }
      const copy = resetCopy[language];
      const actionLink = new URL(data.properties.action_link);
      const projectOrigin = new URL(supabaseUrl).origin;
      if (actionLink.origin !== projectOrigin) throw new Error("Supabase returned an unexpected recovery link origin");

      const safeLink = escapeHtml(actionLink.toString());
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [email],
          subject: copy.subject,
          html: `<!doctype html><html lang="${language}"><body style="margin:0;padding:32px 16px;background:#f5f4ef;font-family:Arial,sans-serif;color:#29372f"><table role="presentation" style="max-width:560px;margin:0 auto;background:#fffefa;border:1px solid #e4e1d8;padding:36px;width:100%"><tr><td><p style="font-size:11px;letter-spacing:3px;color:#8c7554;font-weight:bold">TSOGO-BIS</p><h1 style="font:normal 30px Georgia,serif;margin:26px 0 12px">${copy.title}</h1><p style="font-size:14px;line-height:1.7;color:#687168">${copy.intro}</p><p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;background:#26372f;color:#fffefa;text-decoration:none;padding:14px 22px;font-size:13px;font-weight:bold">${copy.action}</a></p><p style="font-size:12px;line-height:1.6;color:#7b8179">${copy.ignore}</p></td></tr></table></body></html>`,
          text: `${copy.textTitle}\n\n${copy.textAction} ${actionLink}\n\n${copy.textIgnore}`,
        }),
      });

      if (!response.ok) {
        console.error("Resend rejected password reset email:", response.status);
        return respond({ error: "Password reset email could not be sent. Please try again later." }, 502, origin);
      }
    } else if (error && !/user not found|no user/i.test(error.message)) {
      console.error("Supabase could not generate a recovery link:", error.message);
      return respond({ error: "Password reset is temporarily unavailable" }, 503, origin);
    }

    return respond({ message: "If an account exists for this email, a password reset link will arrive shortly." }, 200, origin);
  } catch (error) {
    console.error("Password reset email failed:", error);
    return respond({ error: "Password reset email could not be sent. Please try again later." }, 502, origin);
  }
});

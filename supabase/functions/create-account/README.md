# Signup confirmation email

Signup confirmation is sent directly through Resend by this Edge Function. Supabase Auth SMTP and the Auth email template are not used for signup confirmation. The same public function accepts `action: "resend_confirmation"` to issue a fresh confirmation link for an existing, unconfirmed account. Unknown and already confirmed addresses receive the same generic response.

Required Supabase Edge Function secrets (the same sender credentials used by the other Resend functions):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (must be a verified Resend sender)
- `APP_URL` (the public storefront origin)
- `RESET_RATE_LIMIT_SECRET`
- `ALLOWED_ORIGINS` (comma-separated storefront origins; include `http://localhost:5173` during local development)

Apply `20261022200000_password_reset_rate_limit.sql` and `20261025110000_secure_signup_referral_recording.sql` first. Signup uses the rate-limit table and the `public.record_signup_referral` RPC; the RPC keeps referral profile repair within the database instead of granting the Edge Function broad write access to `profiles`. Add the site root (`APP_URL/`) to Supabase Auth's allowed redirect URLs so the generated confirmation link can return users to the storefront.

Deploy with `supabase functions deploy create-account`. The local `supabase/config.toml` disables JWT verification for this function because signup is public; the function validates its origin, inputs, and rate limits requests itself. Do not put the service-role key or Resend API key in the browser app.

# Resend password reset function

This function creates a Supabase Auth recovery link with the service role key and sends the message through Resend. The service role key stays in the Edge Function environment; it is never sent to the browser. Responses do not reveal whether an email has a TSOGO-BIS account.

## Configure secrets

Set these secrets in the Supabase project before deploying:

- `RESEND_API_KEY`: Resend API key allowed to send email.
- `RESEND_FROM_EMAIL`: verified Resend sender, for example `TSOGO-BIS <accounts@your-verified-domain>`.
- `APP_URL`: public site origin, for example `https://shop.example.com`.
- `ALLOWED_ORIGINS`: optional comma-separated browser origins. Add `http://localhost:5173` when using the local Vite app.
- `RESET_RATE_LIMIT_SECRET`: a random secret used to HMAC-hash requester IP addresses before storing rate-limit buckets.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: Supabase Edge Function runtime secrets, normally provided automatically by Supabase.

Deploy from the repository root after linking the correct Supabase project:

```sh
supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL="TSOGO-BIS <accounts@your-verified-domain>" APP_URL=https://shop.example.com ALLOWED_ORIGINS=http://localhost:5173 RESET_RATE_LIMIT_SECRET=...
supabase functions deploy send-password-reset
```

Apply `supabase/migrations/20261022200000_password_reset_rate_limit.sql` before deploying. Also allow `APP_URL/reset-password` in Supabase Auth's redirect URL configuration. The function atomically limits both requester IPs and recipient email addresses to four attempts per fifteen minutes, stores only keyed hashes of those values, and gives the same success response for known and unknown email addresses.

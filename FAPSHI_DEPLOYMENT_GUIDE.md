# Fapshi Payment Integration - Deployment Guide

## Edge Functions Created

1. **fapshi-pay** - Initiates Fapshi payment
2. **verify-fapshi-payment** - Verifies payment status
3. **currency-rate** - Fetches currency exchange rates

## Prerequisites

1. Supabase CLI installed
2. Fapshi account with API credentials
3. Exchange Rate API key (optional, for currency conversion)

## Environment Variables Setup

You need to set these environment variables in your Supabase project:

```bash
# Fapshi Credentials
FAPSHI_API_KEY=your_fapshi_api_key
FAPSHI_USER_ID=your_fapshi_user_id

# Webhook Secret (for payment verification)
WEBHOOK_SECRET=your_webhook_secret

# Exchange Rate API (optional)
EXCHANGE_RATE_API_KEY=your_exchange_rate_api_key

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5173
```

### Setting Environment Variables

#### Option 1: Via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions**
3. Add each environment variable

#### Option 2: Via CLI
```bash
supabase secrets set FAPSHI_API_KEY=your_key
supabase secrets set FAPSHI_USER_ID=your_user_id
supabase secrets set WEBHOOK_SECRET=your_secret
supabase secrets set EXCHANGE_RATE_API_KEY=your_key
supabase secrets set FRONTEND_URL=http://localhost:5173
```

## Deployment Steps

### 1. Login to Supabase
```bash
supabase login
```

### 2. Link Your Project
```bash
supabase link --project-ref your-project-ref
```

### 3. Deploy Edge Functions
```bash
# Deploy all functions
supabase functions deploy fapshi-pay
supabase functions deploy verify-fapshi-payment
supabase functions deploy currency-rate
```

Or deploy all at once:
```bash
supabase functions deploy
```

### 4. Verify Deployment
```bash
# List deployed functions
supabase functions list
```

## Testing the Functions

### Test fapshi-pay
```bash
curl -i --location --request POST 'https://your-project-ref.supabase.co/functions/v1/fapshi-pay' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Test User",
    "phone": "+237600000000",
    "address": "Test Address",
    "total": 1000,
    "items": [{"product_id": 1, "quantity": 1, "price": 1000}],
    "userId": "test-user-id",
    "email": "test@example.com",
    "message": "Test payment"
  }'
```

### Test verify-fapshi-payment
```bash
curl -i --location --request POST 'https://your-project-ref.supabase.co/functions/v1/verify-fapshi-payment' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'x-webhook-secret: YOUR_WEBHOOK_SECRET' \
  --header 'Content-Type: application/json' \
  --data '{
    "reference": "payment_reference_id",
    "checkout_id": "checkout_id"
  }'
```

### Test currency-rate
```bash
curl -i --location --request GET 'https://your-project-ref.supabase.co/functions/v1/currency-rate' \
  --header 'Authorization: Bearer YOUR_ANON_KEY'
```

## CORS Configuration

All functions include proper CORS headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, apikey, x-webhook-secret`

## Database Schema Requirements

Ensure your `checkouts` table has these columns:
- `checkout_id` (primary key)
- `user_name` (text)
- `phone_number` (text)
- `address` (text)
- `total` (numeric)
- `user_id` (text)
- `items` (jsonb)
- `status` (text)
- `payment_reference` (text, nullable)
- `created_at` (timestamp)

## Troubleshooting

### CORS Errors
- Ensure all functions handle OPTIONS requests
- Check that CORS headers are present in all responses
- Verify the function is deployed correctly

### Payment Initialization Fails
- Check FAPSHI_API_KEY and FAPSHI_USER_ID are set correctly
- Verify Fapshi API endpoint is accessible
- Check function logs: `supabase functions logs fapshi-pay`

### Payment Verification Fails
- Ensure WEBHOOK_SECRET matches between frontend and backend
- Check payment reference is correct
- Verify Fapshi payment status endpoint is accessible

### Currency Rate Fails
- Check EXCHANGE_RATE_API_KEY is set
- Verify API quota hasn't been exceeded
- Check function logs: `supabase functions logs currency-rate`

## Monitoring

View function logs:
```bash
# Real-time logs
supabase functions logs fapshi-pay --follow

# Specific function logs
supabase functions logs verify-fapshi-payment
supabase functions logs currency-rate
```

## Production Checklist

- [ ] All environment variables set in production
- [ ] FRONTEND_URL updated to production URL
- [ ] Fapshi API credentials are for production (not sandbox)
- [ ] WEBHOOK_SECRET is strong and secure
- [ ] Database has proper indexes on checkout_id
- [ ] Error monitoring is set up
- [ ] Rate limiting is configured
- [ ] SSL/HTTPS is enabled

## Support

For issues with:
- **Fapshi API**: Contact Fapshi support
- **Supabase Edge Functions**: Check Supabase documentation
- **This integration**: Review function logs and error messages

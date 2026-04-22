# Billing setup

This document walks through the one-time setup to get Stripe billing
working end-to-end. Code is in place; these are the config + deploy
steps only you can do.

## 1. Apply the database migration

In the Supabase dashboard → SQL Editor, paste and run the contents of
`supabase/migrations/0001_billing.sql`. That creates the three tables
(`subscriptions`, `entitlements`, `webhook_events`), the `updated_at`
triggers, and the row-level security policies.

Alternatively, if you've linked the Supabase CLI to the project:

```sh
supabase db push
```

## 2. Set the edge function env vars

In the Supabase dashboard → Project Settings → Edge Functions → Secrets,
add these:

| Key | Value | Where to find it |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | Stripe Dashboard → Developers → API Keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Filled in at step 4 (webhook setup) |
| `STRIPE_PRICE_INDIVIDUAL_MONTHLY` | `price_1TFGItRut2P39qd1zBBQcRjg` | |
| `STRIPE_PRICE_INDIVIDUAL_YEARLY` | `price_1TFGK7Rut2P39qd1prt5w9ym` | |
| `STRIPE_PRICE_TEAM_MONTHLY` | `price_1TFGnkRut2P39qd1cetZpP6e` | |
| `STRIPE_PRICE_TEAM_YEARLY` | `price_1TFGoGRut2P39qd1cDUO9oIJ` | |
| `APP_URL` | `https://app.taskpanels.com` | The URL users should be redirected to after checkout. Use `http://localhost:5173` for local dev. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are set
automatically on Supabase-hosted edge functions.

## 3. Deploy the three edge functions

```sh
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag on the webhook is **required** — Stripe
does not send a Supabase JWT. The function verifies the request
using the Stripe signature header (`stripe-signature`) against
`STRIPE_WEBHOOK_SECRET` instead.

## 4. Register the webhook in Stripe

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. After creating, Stripe shows a **Signing secret** (`whsec_...`). Copy
   that into the `STRIPE_WEBHOOK_SECRET` env var on Supabase (step 2).

## 5. Configure the Customer Portal

Stripe Dashboard → Settings → Billing → Customer portal → turn on
at least:
- **Subscriptions**: allow customers to cancel
- **Invoice history**
- **Payment method** update

Save. Without this, the portal session creation will error.

## Testing

Use Stripe's test mode keys and cards. The card `4242 4242 4242 4242`
with any future expiry and any CVC works for successful payments.

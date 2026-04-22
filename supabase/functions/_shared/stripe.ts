// Shared Stripe + Supabase admin client setup for edge functions.
//
// Edge functions run on Deno, so imports come from esm.sh. Pinning the
// Stripe SDK to a concrete version keeps the API version stable even
// if esm.sh resolves "latest" differently over time.

import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno&deno-std=0.208.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

/** Admin client with service role key — bypasses RLS. Use only in edge functions. */
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

/** Caller client — uses the user's JWT so auth.uid() resolves correctly. */
export function callerClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
}

// Price ID → (plan, interval) mapping. The edge function reads IDs from
// env vars so you can swap test/live mode without a code change.
export type Plan = 'individual' | 'team';
export type BillingInterval = 'month' | 'year';

export function priceIdFor(plan: Plan, interval: BillingInterval): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}LY`;
  const priceId = Deno.env.get(key);
  if (!priceId) throw new Error(`Missing env var: ${key}`);
  return priceId;
}

export function planFromPriceId(priceId: string): Plan | null {
  const plans: Plan[] = ['individual', 'team'];
  const intervals: BillingInterval[] = ['month', 'year'];
  for (const plan of plans) {
    for (const interval of intervals) {
      try {
        if (priceIdFor(plan, interval) === priceId) return plan;
      } catch { /* env var missing, ignore */ }
    }
  }
  return null;
}

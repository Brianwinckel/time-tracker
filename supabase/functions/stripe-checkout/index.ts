// ============================================================
// stripe-checkout
// ------------------------------------------------------------
// Creates a Stripe Checkout Session for the authenticated caller.
//
// Input (POST JSON):   { plan: 'individual' | 'team', interval: 'month' | 'year' }
// Output:              { url: string }  ← the URL to redirect the user to
//
// Flow:
//  1. Verify the caller's Supabase JWT (no JWT = 401).
//  2. Look up their Stripe customer id from entitlements. If none exists,
//     create a new Stripe Customer keyed by user.id and stash the id.
//     We also note whether this is their first checkout so we can hint
//     the frontend to route to onboarding on success.
//  3. Create a Checkout Session with the matching price id.
//  4. Return the hosted URL.
// ============================================================

import { adminClient, callerClient, stripe, priceIdFor, type Plan, type BillingInterval } from '../_shared/stripe.ts';
import { json, preflight, corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated' }, 401);

    const { data: { user } } = await callerClient(authHeader).auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as Plan | undefined;
    const interval = (body.interval ?? 'month') as BillingInterval;
    const appUrl: string = body.appUrl ?? Deno.env.get('APP_URL') ?? '';

    if (plan !== 'individual' && plan !== 'team') {
      return json({ error: 'Invalid plan' }, 400);
    }
    if (interval !== 'month' && interval !== 'year') {
      return json({ error: 'Invalid interval' }, 400);
    }
    if (!appUrl) return json({ error: 'Missing appUrl' }, 400);

    const priceId = priceIdFor(plan, interval);
    const admin = adminClient();

    // Reuse an existing Stripe customer if this user has checked out before.
    const { data: existing } = await admin
      .from('entitlements')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id ?? null;
    const isReturningCustomer = !!customerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Stash the customer id so webhooks (which arrive async) and future
      // checkouts can find it. plan stays 'none' until the webhook confirms.
      await admin.from('entitlements').upsert(
        { user_id: user.id, plan: 'none', stripe_customer_id: customerId },
        { onConflict: 'user_id' },
      );
    }

    // new=1 only on first-ever checkout so the frontend can route to onboarding.
    const successFlags = isReturningCustomer ? 'checkout=success' : 'checkout=success&new=1';

    const session = await stripe.checkout.sessions.create({
      customer: customerId!,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      allow_promotion_codes: true,
      success_url: `${appUrl}/?${successFlags}`,
      cancel_url: `${appUrl}/?checkout=canceled`,
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan },
      },
    });

    if (!session.url) return json({ error: 'Failed to create session' }, 500);
    return json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('stripe-checkout error:', message);
    return json({ error: message }, 500);
  }
});

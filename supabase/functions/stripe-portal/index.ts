// ============================================================
// stripe-portal
// ------------------------------------------------------------
// Opens a Stripe Customer Portal session for the authenticated caller.
// The portal lets users update their payment method, view invoices,
// cancel, or switch plans — all from a hosted Stripe page. We wire
// all three "Plan & Billing" rows (Manage Subscription / Payment Method
// / Invoices) to this one function.
//
// Input:   POST (no body required)
// Output:  { url: string }
// ============================================================

import { adminClient, callerClient, stripe } from '../_shared/stripe.ts';
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
    const appUrl: string = body.appUrl ?? Deno.env.get('APP_URL') ?? '';
    if (!appUrl) return json({ error: 'Missing appUrl' }, 400);

    const { data: ent } = await adminClient()
      .from('entitlements')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!ent?.stripe_customer_id) {
      return json({ error: 'No subscription on file' }, 400);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: ent.stripe_customer_id,
      return_url: `${appUrl}/?portal=closed`,
    });

    return json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('stripe-portal error:', message);
    return json({ error: message }, 500);
  }
});

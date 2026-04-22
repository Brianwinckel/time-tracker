// ============================================================
// stripe-webhook
// ------------------------------------------------------------
// Receives events from Stripe and syncs them to our tables.
//
// Handled events:
//   checkout.session.completed          → fetch the new subscription and upsert
//   customer.subscription.created       → upsert subscription + entitlement
//   customer.subscription.updated       → upsert subscription + entitlement
//   customer.subscription.deleted       → mark canceled, clear entitlement
//   invoice.payment_failed              → subscription.updated covers status
//   invoice.paid                        → subscription.updated covers status
//
// Idempotency: every event id is recorded in webhook_events after a
// successful handle. A replayed event (Stripe retries failures) sees
// the existing row and returns 200 without re-processing.
//
// Security: signature is verified with STRIPE_WEBHOOK_SECRET before any
// action. No auth header (Stripe doesn't send one) — that's why this
// function needs to be deployed with `--no-verify-jwt`.
// ============================================================

import type Stripe from 'https://esm.sh/stripe@17.4.0?target=deno&deno-std=0.208.0';
import { adminClient, stripe, planFromPriceId, type Plan } from '../_shared/stripe.ts';

// Statuses that grant app access. Everything else = entitlement 'none'.
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) return new Response('Server misconfigured', { status: 500 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error('webhook signature verification failed:', message);
    return new Response(`Invalid signature: ${message}`, { status: 400 });
  }

  const admin = adminClient();

  // Idempotency: skip if we've already processed this event id.
  const { data: seen } = await admin
    .from('webhook_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (seen) return new Response('ok (replay)', { status: 200 });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null;
        if (userId && subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(admin, sub, userId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id
          ?? await userIdFromCustomer(admin, sub.customer as string);
        if (userId) await syncSubscription(admin, sub, userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id
          ?? await userIdFromCustomer(admin, sub.customer as string);
        await admin.from('subscriptions').update({
          status: 'canceled',
          cancel_at_period_end: false,
        }).eq('id', sub.id);
        if (userId) {
          // Downgrade entitlement but keep stripe_customer_id so re-subscribe
          // reuses the same Stripe customer.
          await admin.from('entitlements').update({
            plan: 'none',
            subscription_id: null,
          }).eq('user_id', userId);
        }
        break;
      }

      // invoice.paid / invoice.payment_failed are reflected via subscription.updated,
      // so we don't need dedicated handlers. Keeping them harmless.
      default:
        break;
    }

    await admin.from('webhook_events').insert({ id: event.id, type: event.type });
    return new Response('ok', { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`webhook ${event.type} error:`, message);
    return new Response(`Error: ${message}`, { status: 500 });
  }
});

/** Upsert the subscriptions row + entitlements row from a Stripe Subscription object. */
async function syncSubscription(
  admin: ReturnType<typeof adminClient>,
  sub: Stripe.Subscription,
  userId: string,
): Promise<void> {
  const item = sub.items.data[0];
  const priceId = item.price.id;
  const interval = item.price.recurring?.interval ?? 'month';
  const plan = (planFromPriceId(priceId) ?? 'individual') as Plan;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  await admin.from('subscriptions').upsert({
    id: sub.id,
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_price_id: priceId,
    plan,
    interval,
    status: sub.status,
    current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
    current_period_end:   sub.current_period_end   ? new Date(sub.current_period_end * 1000).toISOString()   : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_end:            sub.trial_end            ? new Date(sub.trial_end * 1000).toISOString()            : null,
  }, { onConflict: 'id' });

  const entitledPlan = ACTIVE_STATUSES.has(sub.status) ? plan : 'none';

  await admin.from('entitlements').upsert({
    user_id: userId,
    plan: entitledPlan,
    subscription_id: sub.id,
    stripe_customer_id: customerId,
    source: 'stripe',
  }, { onConflict: 'user_id' });
}

/** Fallback: if the subscription metadata is missing, look up the user via our entitlements row. */
async function userIdFromCustomer(
  admin: ReturnType<typeof adminClient>,
  customerId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('entitlements')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

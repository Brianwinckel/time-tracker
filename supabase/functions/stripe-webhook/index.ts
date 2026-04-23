// ============================================================
// stripe-webhook (deployed v10 — fixes race between concurrent
// subscription.created/updated events). Deploy with:
//
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// The --no-verify-jwt flag is REQUIRED — Stripe does not send a
// Supabase JWT. The function verifies the request using the Stripe
// signature header against STRIPE_WEBHOOK_SECRET instead.
//
// v10: upsertSubscriptionAndEntitlements now re-retrieves the sub
// from Stripe before writing. Under load, Stripe can deliver
// subscription.created (status=incomplete) and .updated (status=
// active) within milliseconds, and our edge functions run
// concurrently — the older-state event can land in the DB last
// and stick the sub at incomplete. Re-fetching guarantees every
// upsert writes the latest truth.
//
// v9: checkout.session.completed handler creates the teams row,
// wires the creator's profile (team_id, department_id, team_role),
// and inserts billing_customers scoped to the team — atomically,
// only after Stripe confirms payment.
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

const INDIVIDUAL_FEATURES = {
  unlimited_panels: true, max_custom_panels: 999, history_days: 365,
  daily_summary_basic: true, daily_summary_full: true,
  blocker_tracking: true, passoff_tracking: true, unrealized_effort: true,
  weekly_reports: true, exports: true, email_tools: true,
  manager_dashboard: false, team_visibility: false, shared_rollups: false, admin_controls: false,
};
const TEAM_FEATURES = { ...INDIVIDUAL_FEATURES,
  manager_dashboard: true, team_visibility: true, shared_rollups: true, admin_controls: true,
};
const FREE_FEATURES = {
  unlimited_panels: false, max_custom_panels: 5, history_days: 7,
  daily_summary_basic: true, daily_summary_full: false,
  blocker_tracking: false, passoff_tracking: false, unrealized_effort: false,
  weekly_reports: false, exports: false, email_tools: false,
  manager_dashboard: false, team_visibility: false, shared_rollups: false, admin_controls: false,
};

function getFeaturesForPlan(plan: string) {
  if (plan === 'team') return TEAM_FEATURES;
  if (plan === 'individual') return INDIVIDUAL_FEATURES;
  return FREE_FEATURES;
}

// Three env-var naming conventions are supported so keys can be rotated
// without coordinated downtime: the new canonical STRIPE_PRICE_INDIVIDUAL_*,
// transitional STRIPE_PRICE_PRO_*, and legacy STRIPE_PRO_*_PRICE_ID.
function mapPriceIdToPlan(priceId: string): 'individual' | 'team' {
  const check = (key: string) => Deno.env.get(key) === priceId;
  const isIndividual =
    check('STRIPE_PRICE_INDIVIDUAL_MONTHLY') || check('STRIPE_PRICE_INDIVIDUAL_YEARLY') ||
    check('STRIPE_PRICE_PRO_MONTHLY')        || check('STRIPE_PRICE_PRO_YEARLY') ||
    check('STRIPE_PRO_MONTHLY_PRICE_ID')     || check('STRIPE_PRO_YEARLY_PRICE_ID');
  const isTeam =
    check('STRIPE_PRICE_TEAM_MONTHLY')       || check('STRIPE_PRICE_TEAM_YEARLY') ||
    check('STRIPE_TEAM_MONTHLY_PRICE_ID')    || check('STRIPE_TEAM_YEARLY_PRICE_ID');
  if (isTeam) return 'team';
  if (isIndividual) return 'individual';
  console.warn('[webhook] unknown price id, defaulting to individual:', priceId);
  return 'individual';
}

function mapInterval(priceId: string): 'month' | 'year' {
  const yearKeys = [
    'STRIPE_PRICE_INDIVIDUAL_YEARLY', 'STRIPE_PRICE_PRO_YEARLY', 'STRIPE_PRO_YEARLY_PRICE_ID',
    'STRIPE_PRICE_TEAM_YEARLY',       'STRIPE_TEAM_YEARLY_PRICE_ID',
  ];
  for (const k of yearKeys) if (Deno.env.get(k) === priceId) return 'year';
  return 'month';
}

function isoFromUnix(sec: number | null | undefined): string | null {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null;
  return new Date(sec * 1000).toISOString();
}

// Stripe API 2024-06-20 moved current_period_start/end from the
// Subscription object to the SubscriptionItem. We read the new
// location first and fall back to the legacy one.
function periodFromSub(sub: Stripe.Subscription): { start: number | null; end: number | null } {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  }) | undefined;
  const start = item?.current_period_start
    ?? (sub as Stripe.Subscription & { current_period_start?: number | null }).current_period_start
    ?? null;
  const end = item?.current_period_end
    ?? (sub as Stripe.Subscription & { current_period_end?: number | null }).current_period_end
    ?? null;
  return { start: start ?? null, end: end ?? null };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] signature verification failed:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Invalid signature', detail: (err as Error).message }), { status: 400 });
  }

  console.log(`[webhook] received ${event.type} (${event.id})`);
  const supabase = createClient(supabaseUrl, serviceKey);

  // Check-first idempotency. We record the event id AFTER the handler
  // runs successfully — otherwise a transient failure would leave the
  // row in place, causing Stripe's retry to short-circuit as a "dup"
  // without ever running the actual work.
  const { data: existing } = await supabase
    .from('subscription_events').select('stripe_event_id').eq('stripe_event_id', event.id).maybeSingle();
  if (existing) {
    console.log(`[webhook] event ${event.id} already processed, skipping`);
    return new Response(JSON.stringify({ received: true, deduplicated: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  let subRefForLog: string | null = null;
  let customerRefForLog: string | null = null;

  // Shared subscription+entitlement upsert logic. Called from both
  // `customer.subscription.*` events and `checkout.session.completed`
  // (the latter bootstraps teams and needs to write the subscription
  // row itself, since sub.created may have arrived first and been
  // skipped for lack of a billing_customer).
  type SupabaseClient = ReturnType<typeof createClient>;
  async function upsertSubscriptionAndEntitlements(
    supabaseClient: SupabaseClient,
    sub: Stripe.Subscription,
  ): Promise<void> {
    // Stripe can deliver customer.subscription.created and .updated
    // events within milliseconds of each other, and our edge-function
    // instances run concurrently. If .created (status=incomplete)
    // lands in the DB *after* .updated (status=active) because of a
    // scheduling hiccup, the row gets stuck incomplete.
    //
    // Always re-retrieve the current state from Stripe so every
    // upsert writes the latest truth, regardless of event ordering.
    try {
      sub = await stripe.subscriptions.retrieve(sub.id);
    } catch (err) {
      console.warn(`[webhook] sub re-fetch failed, using event payload:`, (err as Error).message);
    }

    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const priceId = sub.items.data[0]?.price?.id || '';
    const plan = mapPriceIdToPlan(priceId);
    const interval = mapInterval(priceId);

    console.log(`[webhook] upsert sub ${sub.id} status=${sub.status} plan=${plan}`);

    const { data: bc, error: bcErr } = await supabaseClient
      .from('billing_customers').select('*').eq('stripe_customer_id', customerId).single();
    if (bcErr) {
      console.error('[webhook] billing_customer lookup failed:', bcErr.message);
      throw new Error(`billing_customer lookup: ${bcErr.message}`);
    }
    if (!bc) {
      // Expected when sub.created fires before checkout.session.completed
      // for a new-team purchase. The checkout.session.completed handler
      // will catch up by calling this function once the bootstrap is done.
      console.log('[webhook] no billing_customer yet for:', customerId, '— deferring');
      return;
    }

    const { start: periodStart, end: periodEnd } = periodFromSub(sub);
    const nowIso = new Date().toISOString();
    const fallbackEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const periodStartISO = isoFromUnix(periodStart) ?? nowIso;
    const periodEndISO   = isoFromUnix(periodEnd)   ?? fallbackEnd;
    const quantity = sub.items.data[0]?.quantity || 1;

    const { data: subRow, error: subErr } = await supabaseClient
      .from('subscriptions').upsert({
        billing_customer_id: bc.id,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        plan,
        status: sub.status,
        billing_interval: interval,
        current_period_start: periodStartISO,
        current_period_end:   periodEndISO,
        cancel_at_period_end: sub.cancel_at_period_end,
        trial_end:            isoFromUnix(sub.trial_end),
        quantity,
        updated_at: nowIso,
      }, { onConflict: 'stripe_subscription_id' }).select('id').single();

    if (subErr) {
      console.error('[webhook] subscription upsert failed:', JSON.stringify(subErr));
      throw new Error(`subscription upsert: ${subErr.message}`);
    }

    // Keep teams.seats_purchased in sync with Stripe's quantity so
    // the app can show "X of Y seats used" without hitting Stripe.
    if (bc.team_id) {
      await supabaseClient
        .from('teams').update({ seats_purchased: quantity }).eq('id', bc.team_id);
    }

    const isActive = ['active', 'trialing'].includes(sub.status);
    const features = isActive ? getFeaturesForPlan(plan) : FREE_FEATURES;
    const entPlan = isActive ? plan : 'free';
    const entSource = isActive ? (bc.team_id ? 'team_membership' : 'subscription') : 'default';
    const validUntil = isActive ? periodEndISO : null;

    const writeEntitlement = async (userId: string) => {
      const { error } = await supabaseClient.from('entitlements').upsert({
        user_id: userId, plan: entPlan, source: entSource, features,
        subscription_id: subRow?.id ?? null,
        valid_until: validUntil,
        updated_at: nowIso,
      }, { onConflict: 'user_id' });
      if (error) {
        console.error('[webhook] entitlement upsert failed:', JSON.stringify(error));
        throw new Error(`entitlement upsert: ${error.message}`);
      }
    };

    if (bc.user_id) {
      await writeEntitlement(bc.user_id);
    } else if (bc.team_id) {
      const { data: members } = await supabaseClient
        .from('profiles').select('id').eq('team_id', bc.team_id);
      for (const m of (members || [])) await writeEntitlement(m.id);
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const md = session.metadata || {};
        customerRefForLog = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id ?? null;

        // Backfill profile.name from Stripe's billing details when empty.
        const billingName = session.customer_details?.name?.trim();
        if (md.user_id && billingName) {
          const { data: prof } = await supabase
            .from('profiles').select('name').eq('id', md.user_id).single();
          if (prof && !prof.name?.trim()) {
            await supabase.from('profiles').update({ name: billingName }).eq('id', md.user_id);
          }
        }

        // Individual checkouts have their billing_customers row created
        // pre-checkout by the edge function; nothing to bootstrap here.
        if (md.mode !== 'team') break;

        const userId = md.user_id;
        const teamName = md.team_name;
        const seats = parseInt(md.seats || '0', 10);
        const customerId = customerRefForLog;

        if (!userId || !teamName || !customerId || !seats) {
          console.error('[webhook] team session missing metadata:', md);
          break;
        }

        // Idempotency: if the creator already has a team_id, bootstrap
        // already ran (Stripe can redeliver this event).
        const { data: existingProfile } = await supabase
          .from('profiles').select('team_id').eq('id', userId).single();

        if (!existingProfile?.team_id) {
          const { data: team, error: teamErr } = await supabase
            .from('teams')
            .insert({ name: teamName, created_by: userId, seats_purchased: seats })
            .select('id, default_department_id')
            .single();
          if (teamErr || !team) {
            console.error('[webhook] team insert failed:', teamErr?.message);
            throw new Error(`team insert: ${teamErr?.message}`);
          }

          const { error: profErr } = await supabase
            .from('profiles')
            .update({
              team_id: team.id,
              department_id: team.default_department_id,
              team_role: 'owner',
            })
            .eq('id', userId);
          if (profErr) {
            console.error('[webhook] profile update failed:', profErr.message);
            throw new Error(`profile update: ${profErr.message}`);
          }

          const { error: bcErr } = await supabase
            .from('billing_customers')
            .insert({ team_id: team.id, stripe_customer_id: customerId });
          if (bcErr) {
            console.error('[webhook] billing_customer insert failed:', bcErr.message);
            throw new Error(`billing_customer insert: ${bcErr.message}`);
          }
        }

        // Catch-up: sub.created may have arrived first and bailed for
        // missing billing_customer. Now that it exists, upsert the sub.
        if (session.subscription) {
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          subRefForLog = subId;
          const fullSub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscriptionAndEntitlements(supabase, fullSub);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        subRefForLog = sub.id;
        customerRefForLog = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        await upsertSubscriptionAndEntitlements(supabase, sub);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        subRefForLog = sub.id;
        customerRefForLog = customerId;

        await supabase.from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);

        const { data: bc } = await supabase
          .from('billing_customers').select('*').eq('stripe_customer_id', customerId).single();

        const revert = async (userId: string) => {
          await supabase.from('entitlements').upsert({
            user_id: userId, plan: 'free', source: 'default',
            features: FREE_FEATURES, subscription_id: null, valid_until: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        };
        if (bc?.user_id) await revert(bc.user_id);
        else if (bc?.team_id) {
          const { data: members } = await supabase.from('profiles').select('id').eq('team_id', bc.team_id);
          for (const m of (members || [])) await revert(m.id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
        if (subId) {
          subRefForLog = subId;
          await supabase.from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', subId);
        }
        break;
      }

      default:
        console.log(`[webhook] no-op for event type ${event.type}`);
        break;
    }
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[webhook] handler for ${event.type} threw:`, message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Record the event only after the handler succeeds. A unique-
  // constraint violation on re-fire is fine; anything else is loggable.
  try {
    const { error } = await supabase.from('subscription_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      stripe_subscription_id: subRefForLog,
      stripe_customer_id: customerRefForLog,
      payload: event.data.object as Record<string, unknown>,
    });
    if (error && error.code !== '23505') {
      console.error('[webhook] subscription_events insert (non-fatal):', error.message);
    }
  } catch (err) {
    console.error('[webhook] subscription_events insert threw (non-fatal):', (err as Error).message);
  }

  console.log(`[webhook] completed ${event.type}`);
  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});

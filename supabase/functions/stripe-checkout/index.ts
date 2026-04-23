// ============================================================
// stripe-checkout (deployed v9 — adds team bootstrap via webhook).
//
// Creates a Stripe Checkout Session for the authenticated caller.
// On first-ever checkout for a billing_customer we append &new=1 to
// the success URL so the frontend can route new customers to
// onboarding. Existing customers (re-subscribing after cancel,
// upgrading, etc.) land on the regular app home.
//
// v9: mode='team' + no existing team_id now creates a Stripe
// Checkout Session using customer_email (no pre-created Stripe
// customer, no billing_customers row). Team name + seat count are
// passed via session metadata; the webhook handler creates the
// team atomically on checkout.session.completed. Abandoned
// checkouts leave zero app-side state.
//
// Deploy with:  supabase functions deploy stripe-checkout
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Three env-var naming conventions supported; see stripe-webhook for rationale.
function priceIdFor(plan: 'individual' | 'team', interval: 'month' | 'year'): string | null {
  const INT = interval.toUpperCase() + 'LY'; // MONTHLY / YEARLY
  const candidates = plan === 'individual'
    ? [`STRIPE_PRICE_INDIVIDUAL_${INT}`, `STRIPE_PRICE_PRO_${INT}`, `STRIPE_PRO_${INT}_PRICE_ID`]
    : [`STRIPE_PRICE_TEAM_${INT}`, `STRIPE_TEAM_${INT}_PRICE_ID`];
  for (const key of candidates) {
    const v = Deno.env.get(key);
    if (v) return v;
  }
  return null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawPlan = body.plan as string | undefined;
    // 'pro' is aliased to 'individual' for backward compat with the legacy
    // PricingCards UI; the current tier in the new UX is 'individual'.
    const plan: 'individual' | 'team' | null =
      rawPlan === 'individual' || rawPlan === 'pro' ? 'individual' :
      rawPlan === 'team' ? 'team' : null;
    const interval: 'month' | 'year' = body.interval === 'year' ? 'year' : 'month';
    const mode: 'user' | 'team' = body.mode === 'team' ? 'team' : 'user';
    const teamName: string = typeof body.teamName === 'string' ? body.teamName.trim() : '';
    const seats: number = typeof body.seats === 'number'
      ? body.seats
      : parseInt(String(body.seats || 0), 10) || 0;

    if (!plan) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceId = priceIdFor(plan, interval);
    if (!priceId) {
      return new Response(JSON.stringify({ error: `No price configured for ${plan}/${interval}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- New-team checkout path ---
    // mode=team + no existing team membership = buying a brand-new team.
    // We skip creating any app-side rows here; the webhook
    // (checkout.session.completed) creates teams, billing_customers, and
    // profile updates atomically once payment succeeds. That way abandoned
    // checkouts leave zero state.
    if (plan === 'team' && mode === 'team' && !profile.team_id) {
      if (!teamName) {
        return new Response(JSON.stringify({ error: 'Team name is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (seats < 5) {
        return new Response(JSON.stringify({ error: 'Team plan requires at least 5 seats' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const origin = req.headers.get('origin') || body.appUrl || 'https://app.taskpanels.app';
      const metadata = {
        user_id: user.id,
        plan: 'team',
        mode: 'team',
        team_name: teamName,
        seats: String(seats),
      };

      const session = await stripe.checkout.sessions.create({
        customer_email: user.email || undefined,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: seats }],
        success_url: `${origin}/?checkout=success&new=1&mode=team`,
        cancel_url: `${origin}/?checkout=canceled`,
        allow_promotion_codes: true,
        client_reference_id: user.id,
        subscription_data: { metadata },
        metadata,
      } as Stripe.Checkout.SessionCreateParams);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hasTeam = mode === 'team' && profile.team_id;
    const scopeCol = hasTeam ? 'team_id' : 'user_id';
    const scopeVal = hasTeam ? profile.team_id : user.id;

    let { data: bc } = await supabase
      .from('billing_customers').select('*').eq(scopeCol, scopeVal).single();

    const isFirstCheckout = !bc;

    if (!bc) {
      const customer = await stripe.customers.create({
        email: user.email || '',
        name: profile.name || user.email || '',
        metadata: { user_id: user.id, team_id: hasTeam ? profile.team_id : '', plan_mode: mode },
      });
      const insertData: Record<string, unknown> = { stripe_customer_id: customer.id };
      if (hasTeam) insertData.team_id = scopeVal; else insertData.user_id = scopeVal;
      const { data: newBc, error: insertErr } = await supabase
        .from('billing_customers').insert(insertData).select().single();
      if (insertErr) {
        return new Response(JSON.stringify({ error: 'Failed to create billing customer: ' + insertErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      bc = newBc;
    }

    let quantity = 1;
    if (hasTeam && plan === 'team') {
      const { count } = await supabase
        .from('profiles').select('*', { count: 'exact', head: true }).eq('team_id', profile.team_id);
      quantity = Math.max(count || 1, 1);
    }

    const origin = req.headers.get('origin') || body.appUrl || 'https://app.taskpanels.app';
    const newFlag = isFirstCheckout ? '&new=1' : '';

    const session = await stripe.checkout.sessions.create({
      customer: bc.stripe_customer_id,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity }],
      success_url: `${origin}/?checkout=success${newFlag}`,
      cancel_url: `${origin}/?checkout=canceled`,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      subscription_data: { metadata: { user_id: user.id, plan, mode } },
      metadata: { user_id: user.id, plan, mode },
    } as Stripe.Checkout.SessionCreateParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

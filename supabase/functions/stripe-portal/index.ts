// ============================================================
// stripe-portal (deployed v5 — mirrors Supabase Edge Function).
//
// Opens a Stripe Customer Portal session for the authenticated
// caller. The portal page covers subscription management, payment
// method, and invoice history — so all three "Plan & Billing"
// rows in Profile Settings route here.
//
// Deploy with:  supabase functions deploy stripe-portal
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
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

    // Try user-scoped billing customer first, then team-scoped.
    let { data: bc } = await supabase
      .from('billing_customers').select('*').eq('user_id', user.id).single();
    if (!bc) {
      const { data: profile } = await supabase
        .from('profiles').select('team_id').eq('id', user.id).single();
      if (profile?.team_id) {
        const { data: teamBc } = await supabase
          .from('billing_customers').select('*').eq('team_id', profile.team_id).single();
        bc = teamBc;
      }
    }

    if (!bc) {
      return new Response(JSON.stringify({ error: 'No billing account found. Subscribe to a plan first.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const origin = req.headers.get('origin') || body.appUrl || 'https://app.taskpanels.app';
    const session = await stripe.billingPortal.sessions.create({
      customer: bc.stripe_customer_id,
      return_url: `${origin}/?portal=closed`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Portal error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

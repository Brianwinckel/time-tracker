// ============================================================
// resend-team-invite (v1)
// ------------------------------------------------------------
// Re-sends the invite email for an existing pending invite.
// Since the auth.users row already exists from the original
// invite, we use signInWithOtp (which works for existing users)
// to send a fresh magic-link email. On sign-in, the
// accept_pending_team_invite RPC picks up the still-pending
// team_invites row and wires the profile.
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json(401, { error: 'Missing authorization header' });
    const supabase = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json(401, { error: 'Unauthorized' });

    const body = await req.json().catch(() => ({}));
    const inviteId = typeof body.inviteId === 'string' ? body.inviteId : '';
    const appUrl = typeof body.appUrl === 'string' ? body.appUrl : 'https://app.taskpanels.app';
    if (!inviteId) return json(400, { error: 'inviteId required' });

    const { data: caller } = await supabase
      .from('profiles').select('team_id, team_role').eq('id', user.id).single();
    if (!caller?.team_id || (caller.team_role !== 'owner' && caller.team_role !== 'admin')) {
      return json(403, { error: 'Not authorized' });
    }

    const { data: invite } = await supabase
      .from('team_invites')
      .select('email, team_id, accepted_at')
      .eq('id', inviteId)
      .single();
    if (!invite) return json(404, { error: 'Invite not found' });
    if (invite.team_id !== caller.team_id) return json(403, { error: 'Not authorized' });
    if (invite.accepted_at) return json(400, { error: 'Invite already accepted' });

    // signInWithOtp goes through the anon-keyed client (it's a public
    // auth method, not an admin one). shouldCreateUser=false because
    // the user was already created on the original invite.
    const publicClient = createClient(supabaseUrl, anonKey);
    const { error: otpErr } = await publicClient.auth.signInWithOtp({
      email: invite.email,
      options: {
        emailRedirectTo: `${appUrl}/?invite=accepted`,
        shouldCreateUser: false,
      },
    });
    if (otpErr) {
      console.error('[resend-invite] OTP send failed:', otpErr.message);
      return json(500, { error: otpErr.message });
    }

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: (err as Error).message });
  }
});

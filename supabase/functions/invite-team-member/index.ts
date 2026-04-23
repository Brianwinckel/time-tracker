// ============================================================
// invite-team-member (v1)
// ------------------------------------------------------------
// Called by a team owner/admin to invite someone by email.
//
// Flow:
//   1. Authenticate caller via their JWT, verify team_role.
//   2. Validate seat capacity (members + pending < seats_purchased).
//   3. Validate department (must belong to the caller's team).
//   4. Insert public.team_invites row (pending).
//   5. Call supabase.auth.admin.inviteUserByEmail — Supabase sends
//      the branded invite email via the configured SMTP (Brevo).
//      A new auth.users row is created; the handle_new_user trigger
//      creates a blank profile. The invite is only applied (profile
//      wired to team) when the user actually signs in and calls
//      public.accept_pending_team_invite().
//
// Deploy with:  supabase functions deploy invite-team-member
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

    // Use the service role to bypass RLS for team lookups + the admin invite.
    const supabase = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json(401, { error: 'Unauthorized' });

    const body = await req.json().catch(() => ({}));
    const email: string = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const departmentId: string | null = typeof body.departmentId === 'string' ? body.departmentId : null;
    const role: 'admin' | 'member' = body.role === 'admin' ? 'admin' : 'member';
    const appUrl: string = typeof body.appUrl === 'string' ? body.appUrl : 'https://app.taskpanels.app';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: 'Valid email required' });
    }

    // Caller must be on a team and be owner/admin.
    const { data: callerProfile, error: pErr } = await supabase
      .from('profiles').select('team_id, team_role').eq('id', user.id).single();
    if (pErr || !callerProfile) return json(404, { error: 'Caller profile not found' });
    if (!callerProfile.team_id) return json(403, { error: 'You are not in a team' });
    if (callerProfile.team_role !== 'owner' && callerProfile.team_role !== 'admin') {
      return json(403, { error: 'Only owners and admins can invite' });
    }
    const teamId = callerProfile.team_id;

    // Validate department belongs to the team.
    if (departmentId) {
      const { data: dept } = await supabase
        .from('departments').select('id').eq('id', departmentId).eq('team_id', teamId).maybeSingle();
      if (!dept) return json(400, { error: 'Department not in your team' });
    }

    // Don't let someone invite themselves.
    if (email === (user.email || '').toLowerCase()) {
      return json(400, { error: "You can't invite yourself" });
    }

    // Already on this team?
    const { data: existingMember } = await supabase
      .from('profiles').select('id').eq('team_id', teamId).ilike('email', email).maybeSingle();
    if (existingMember) return json(409, { error: 'This email is already on your team' });

    // Seat capacity = purchased - (current members + pending invites).
    const { data: team } = await supabase
      .from('teams').select('seats_purchased').eq('id', teamId).single();
    const seatsPurchased = team?.seats_purchased ?? 0;

    const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('team_id', teamId),
      supabase.from('team_invites').select('*', { count: 'exact', head: true })
        .eq('team_id', teamId).is('accepted_at', null),
    ]);
    const used = (memberCount ?? 0) + (pendingCount ?? 0);
    if (used >= seatsPurchased) {
      return json(402, {
        error: `At capacity (${used}/${seatsPurchased} seats). Add more seats from Billing to invite.`,
      });
    }

    // Already invited (pending) for this team?
    const { data: existingInvite } = await supabase
      .from('team_invites').select('id').eq('team_id', teamId)
      .ilike('email', email).is('accepted_at', null).maybeSingle();
    if (existingInvite) return json(409, { error: 'An invite is already pending for this email' });

    // Insert the invite row first. If the admin invite email send
    // fails, we'd rather have a DB row we can retry from than to
    // silently lose the invite.
    const { data: invite, error: inviteErr } = await supabase
      .from('team_invites')
      .insert({
        team_id: teamId,
        department_id: departmentId,
        email,
        invited_by: user.id,
        role,
      })
      .select('id')
      .single();
    if (inviteErr) {
      console.error('[invite] insert failed:', inviteErr.message);
      return json(500, { error: `Failed to create invite: ${inviteErr.message}` });
    }

    // Try the admin invite first (creates auth.users + sends branded
    // invite email). If the email is already registered (e.g. they
    // previously signed up via OTP), fall back to a magic-link sign-in
    // — on sign-in, accept_pending_team_invite() picks up the pending
    // row and wires the profile onto the team.
    const { error: emailErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/?invite=accepted`,
    });

    if (emailErr) {
      const alreadyRegistered = /already.*registered|already been registered/i.test(emailErr.message);
      if (alreadyRegistered) {
        const publicClient = createClient(supabaseUrl, anonKey);
        const { error: otpErr } = await publicClient.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${appUrl}/?invite=accepted`,
            shouldCreateUser: false,
          },
        });
        if (otpErr) {
          console.error('[invite] magic-link fallback failed:', otpErr.message);
          return json(500, {
            error: `Invite row created but email send failed: ${otpErr.message}`,
            inviteId: invite?.id,
          });
        }
        return json(200, { ok: true, inviteId: invite?.id, existingUser: true });
      }

      console.error('[invite] email send failed:', emailErr.message);
      return json(500, {
        error: `Invite row created but email send failed: ${emailErr.message}`,
        inviteId: invite?.id,
      });
    }

    return json(200, { ok: true, inviteId: invite?.id });
  } catch (err) {
    console.error('[invite] unhandled:', err);
    return json(500, { error: (err as Error).message });
  }
});

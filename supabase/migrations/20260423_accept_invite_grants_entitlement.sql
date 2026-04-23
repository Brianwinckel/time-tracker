-- Fix: accept_pending_team_invite() now also grants the team entitlement.
--
-- Before: RPC only wired profile (team_id, department_id, team_role).
-- Invited members kept their 'free' entitlement → hit the paywall.
--
-- After: if the team has an active subscription, upsert an entitlement
-- row with plan=team, source=team_membership, pointing at that sub.
-- Mirrors the shape the stripe-webhook writes for existing members.

create or replace function public.accept_pending_team_invite()
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_user_id uuid;
  v_email text;
  v_invite_id uuid;
  v_team_id uuid;
  v_dept_id uuid;
  v_role text;
  v_current_team uuid;
  v_sub_id uuid;
  v_sub_valid_until timestamptz;
  v_team_features jsonb := jsonb_build_object(
    'unlimited_panels', true,
    'max_custom_panels', 999,
    'history_days', 365,
    'daily_summary_basic', true,
    'daily_summary_full', true,
    'blocker_tracking', true,
    'passoff_tracking', true,
    'unrealized_effort', true,
    'weekly_reports', true,
    'exports', true,
    'email_tools', true,
    'manager_dashboard', true,
    'team_visibility', true,
    'shared_rollups', true,
    'admin_controls', true
  );
begin
  v_user_id := auth.uid();
  if v_user_id is null then return null; end if;

  select team_id into v_current_team from public.profiles where id = v_user_id;
  if v_current_team is not null then return null; end if;

  select email into v_email from auth.users where id = v_user_id;
  if v_email is null then return null; end if;

  select id, team_id, department_id, role
    into v_invite_id, v_team_id, v_dept_id, v_role
  from public.team_invites
  where lower(email) = lower(v_email)
    and accepted_at is null
  order by created_at desc
  limit 1;

  if v_invite_id is null then return null; end if;

  update public.profiles
  set team_id = v_team_id,
      department_id = v_dept_id,
      team_role = v_role
  where id = v_user_id;

  update public.team_invites
  set accepted_at = now()
  where id = v_invite_id;

  -- Grant team entitlement if the team has an active sub.
  select s.id, s.current_period_end
    into v_sub_id, v_sub_valid_until
  from public.subscriptions s
  join public.billing_customers bc on bc.id = s.billing_customer_id
  where bc.team_id = v_team_id
    and s.status = 'active'
  order by s.current_period_end desc nulls last
  limit 1;

  if v_sub_id is not null then
    insert into public.entitlements (user_id, plan, source, features, subscription_id, valid_until, updated_at)
    values (v_user_id, 'team', 'team_membership', v_team_features, v_sub_id, v_sub_valid_until, now())
    on conflict (user_id) do update
    set plan = excluded.plan,
        source = excluded.source,
        features = excluded.features,
        subscription_id = excluded.subscription_id,
        valid_until = excluded.valid_until,
        updated_at = excluded.updated_at;
  end if;

  return v_team_id;
end;
$$;

grant execute on function public.accept_pending_team_invite() to authenticated;

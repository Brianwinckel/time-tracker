-- RPCs for the team invite flow. Applied 2026-04-23.
--
-- accept_pending_team_invite():
--   Called by a signed-in user; if their email matches a pending
--   team_invites row, wires their profile (team_id, department_id,
--   team_role) and marks the invite accepted.
--
-- remove_team_member(target_user_id):
--   Called by a team owner/admin; clears the target profile's
--   team wiring. Cannot remove the team owner.

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

  return v_team_id;
end;
$$;

grant execute on function public.accept_pending_team_invite() to authenticated;

create or replace function public.remove_team_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_caller_team uuid;
  v_caller_role text;
  v_target_team uuid;
  v_target_role text;
begin
  select team_id, team_role into v_caller_team, v_caller_role
  from public.profiles where id = auth.uid();
  if v_caller_team is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Not authorized';
  end if;

  select team_id, team_role into v_target_team, v_target_role
  from public.profiles where id = target_user_id;
  if v_target_team is null or v_target_team <> v_caller_team then
    raise exception 'Target is not in your team';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Cannot remove the team owner';
  end if;

  update public.profiles
  set team_id = null,
      department_id = null,
      team_role = 'member'
  where id = target_user_id;
end;
$$;

grant execute on function public.remove_team_member(uuid) to authenticated;

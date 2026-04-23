-- update_team_member_role / update_team_member_department.
-- Applied 2026-04-23. Owner/admin-only in-place edits on roster.
-- Enforces: cannot change owner's role, cannot self-demote, target
-- must be in caller's team, new department must be in caller's team.

create or replace function public.update_team_member_role(
  target_user_id uuid,
  new_role text
)
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

  if new_role not in ('admin', 'member') then
    raise exception 'Invalid role';
  end if;

  select team_id, team_role into v_target_team, v_target_role
  from public.profiles where id = target_user_id;
  if v_target_team is null or v_target_team <> v_caller_team then
    raise exception 'Target is not in your team';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Cannot change the role of the team owner';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Cannot change your own role';
  end if;

  update public.profiles set team_role = new_role where id = target_user_id;
end;
$$;

grant execute on function public.update_team_member_role(uuid, text) to authenticated;

create or replace function public.update_team_member_department(
  target_user_id uuid,
  new_department_id uuid
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_caller_team uuid;
  v_caller_role text;
  v_target_team uuid;
  v_dept_team uuid;
begin
  select team_id, team_role into v_caller_team, v_caller_role
  from public.profiles where id = auth.uid();
  if v_caller_team is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Not authorized';
  end if;

  select team_id into v_target_team
  from public.profiles where id = target_user_id;
  if v_target_team is null or v_target_team <> v_caller_team then
    raise exception 'Target is not in your team';
  end if;

  if new_department_id is not null then
    select team_id into v_dept_team
    from public.departments where id = new_department_id;
    if v_dept_team is null or v_dept_team <> v_caller_team then
      raise exception 'Department not in your team';
    end if;
  end if;

  update public.profiles
  set department_id = new_department_id
  where id = target_user_id;
end;
$$;

grant execute on function public.update_team_member_department(uuid, uuid) to authenticated;

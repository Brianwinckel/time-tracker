-- delete_department: moves a department's members + pending invites to
-- the team's default department, then deletes the row. Applied 2026-04-23.
-- Callable only by owners/admins of the department's team.

create or replace function public.delete_department(target_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_caller_team uuid;
  v_caller_role text;
  v_dept_team uuid;
  v_is_default boolean;
  v_default_id uuid;
begin
  select team_id, team_role into v_caller_team, v_caller_role
  from public.profiles where id = auth.uid();
  if v_caller_team is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Not authorized';
  end if;

  select team_id, is_default into v_dept_team, v_is_default
  from public.departments where id = target_id;
  if v_dept_team is null or v_dept_team <> v_caller_team then
    raise exception 'Department not in your team';
  end if;
  if v_is_default then
    raise exception 'Cannot delete the default department';
  end if;

  select default_department_id into v_default_id
  from public.teams where id = v_dept_team;

  update public.profiles set department_id = v_default_id where department_id = target_id;
  update public.team_invites set department_id = v_default_id where department_id = target_id;
  delete from public.departments where id = target_id;
end;
$$;

grant execute on function public.delete_department(uuid) to authenticated;

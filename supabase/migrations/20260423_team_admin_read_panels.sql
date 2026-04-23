-- Team owners/admins can SELECT panels owned by any teammate.
-- Applied 2026-04-23. Needed so the TeamAdminScreen live activity
-- feed can show panel names (joined by run.panel_id) for peers'
-- currently-running timers. Writes stay owner-only.

create or replace function public.is_team_admin_of(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles target on target.team_id = me.team_id
    where me.id = auth.uid()
      and me.team_role in ('owner', 'admin')
      and target.id = target_user_id
  );
$$;

create policy user_panels_select_team_admin
  on public.user_panels
  for select
  using (public.is_team_admin_of(user_id));

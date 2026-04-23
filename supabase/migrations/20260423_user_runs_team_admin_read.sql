-- Let team owners/admins read teammates' user_runs rows so the
-- TeamAdminScreen "Tracking now" feed can enumerate live timers.
-- Reuses the existing is_team_admin_of() helper to avoid recursion.
create policy "user_runs_select_team_admin"
on public.user_runs for select
to authenticated
using (public.is_team_admin_of(user_id));

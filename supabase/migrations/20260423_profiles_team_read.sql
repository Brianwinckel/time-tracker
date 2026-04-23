-- Allow team members to read teammates' profiles.
-- Without this, Team admin screens can't enumerate members; members can't see
-- each other in the roster; live activity feeds can't resolve user names.
-- Uses the existing get_my_team_id() security-definer helper to avoid RLS
-- recursion.
create policy "Team members can read teammate profiles"
on public.profiles for select
to authenticated
using (
  team_id is not null
  and team_id = public.get_my_team_id()
);

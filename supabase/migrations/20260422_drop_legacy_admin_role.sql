-- Remove legacy global role (employee|manager|admin). No app code reads it.
-- Applied 2026-04-22 via Supabase MCP. team_role on profiles is the new
-- source of truth for team-scoped permissions.

drop policy if exists "Admins can manage all profiles" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Managers can read team profiles" on public.profiles;
drop policy if exists "Admins can manage teams" on public.teams;
drop policy if exists "Admins can read all bug reports" on public.bug_reports;
drop policy if exists "Admins can update bug reports" on public.bug_reports;
drop policy if exists "Admins update feature requests" on public.feature_requests;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop function if exists public.get_my_role();
alter table public.profiles drop column if exists role;

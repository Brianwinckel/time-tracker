-- Phase 1: Teams / Departments / Invites schema
-- Applied 2026-04-22 via Supabase MCP. Legacy teams + team_tasks data
-- was wiped per user confirmation ("all legacy, pre new-UX rebuild").

-- 1. Wipe legacy data
update public.profiles set team_id = null where team_id is not null;
update public.billing_customers set team_id = null where team_id is not null;
delete from public.teams;
drop table if exists public.team_tasks;

drop policy if exists "Authenticated users can read teams" on public.teams;

-- 2. Extend teams
alter table public.teams drop constraint if exists teams_name_key;
alter table public.teams
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists seats_purchased integer not null default 0,
  add column if not exists default_department_id uuid;

-- 3. departments
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (team_id, name)
);
create index if not exists departments_team_id_idx on public.departments (team_id);

alter table public.teams
  add constraint teams_default_department_id_fkey
  foreign key (default_department_id) references public.departments(id) on delete set null;

-- 4. Profile extensions
alter table public.profiles
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists team_role text not null default 'member'
    check (team_role in ('owner','admin','member'));

-- 5. team_invites
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  role text not null default 'member' check (role in ('admin','member')),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists team_invites_pending_uq
  on public.team_invites (team_id, lower(email))
  where accepted_at is null;
create index if not exists team_invites_email_idx on public.team_invites (lower(email));

-- 6. Auto-create "General" department on team insert
create or replace function public.create_default_department()
returns trigger language plpgsql security definer set search_path = public as $$
declare dept_id uuid;
begin
  insert into public.departments (team_id, name, is_default)
  values (new.id, 'General', true)
  returning id into dept_id;
  update public.teams set default_department_id = dept_id where id = new.id;
  return new;
end;
$$;

drop trigger if exists teams_create_default_department on public.teams;
create trigger teams_create_default_department
  after insert on public.teams
  for each row execute function public.create_default_department();

-- 7. RLS
alter table public.departments enable row level security;
alter table public.team_invites enable row level security;

create policy "Members can read their team" on public.teams
  for select using (id = get_my_team_id());

create policy "Authenticated can create teams" on public.teams
  for insert with check (auth.uid() = created_by);

create policy "Owners/admins can update team" on public.teams
  for update using (
    id = get_my_team_id() and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.team_role in ('owner','admin')
    )
  );

create policy "Members can read team departments" on public.departments
  for select using (team_id = get_my_team_id());

create policy "Owners/admins manage departments" on public.departments
  for all
  using (
    team_id = get_my_team_id() and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.team_role in ('owner','admin')
    )
  )
  with check (
    team_id = get_my_team_id() and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.team_role in ('owner','admin')
    )
  );

create policy "Owners/admins manage invites" on public.team_invites
  for all
  using (
    team_id = get_my_team_id() and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.team_role in ('owner','admin')
    )
  )
  with check (
    team_id = get_my_team_id() and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.team_role in ('owner','admin')
    )
  );

create policy "Invitees can read their own invites" on public.team_invites
  for select using (
    lower(email) = lower((select email from auth.users where id = auth.uid()))
  );

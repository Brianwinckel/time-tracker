-- Clients: parent-of-project entity for attribution and reporting.
-- Scope: solo users own their clients (user_id), teams share clients
-- team-wide (team_id). One of the two must be set.
--
-- No billing/invoicing concepts — clients are purely a way to roll up
-- project time for reports like "hours worked for Acme in March."

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_scope_chk check (
    (user_id is not null and team_id is null)
    or (user_id is null and team_id is not null)
  )
);

create index clients_user_id_idx on public.clients(user_id) where user_id is not null;
create index clients_team_id_idx on public.clients(team_id) where team_id is not null;

alter table public.clients enable row level security;

create policy "clients_select"
on public.clients for select
to authenticated
using (
  (user_id is not null and user_id = auth.uid())
  or (team_id is not null and team_id = public.get_my_team_id())
);

create policy "clients_insert"
on public.clients for insert
to authenticated
with check (
  (user_id is not null and user_id = auth.uid() and team_id is null)
  or (team_id is not null and team_id = public.get_my_team_id() and user_id is null)
);

create policy "clients_update"
on public.clients for update
to authenticated
using (
  (user_id is not null and user_id = auth.uid())
  or (team_id is not null and team_id = public.get_my_team_id())
)
with check (
  (user_id is not null and user_id = auth.uid())
  or (team_id is not null and team_id = public.get_my_team_id())
);

create policy "clients_delete"
on public.clients for delete
to authenticated
using (
  (user_id is not null and user_id = auth.uid())
  or (team_id is not null and team_id = public.get_my_team_id())
);

alter table public.user_projects
  add column client_id uuid references public.clients(id) on delete set null;

create index user_projects_client_id_idx
  on public.user_projects(client_id)
  where client_id is not null;

-- Shared projects. Applied 2026-04-23.
-- A user_projects row with department_id set is visible to every
-- member of that department via RLS. Writes stay owner-only.

create or replace function public.get_my_department_id()
returns uuid
language sql
stable
security definer
set search_path = 'public'
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

alter table public.user_projects
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists user_projects_department_id_idx
  on public.user_projects (department_id) where department_id is not null;

drop policy if exists user_projects_select_own on public.user_projects;

create policy user_projects_select_own_or_shared
  on public.user_projects
  for select
  using (
    auth.uid() = user_id
    or (
      department_id is not null
      and department_id = public.get_my_department_id()
    )
  );

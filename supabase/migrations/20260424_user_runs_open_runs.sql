-- Timer unification: open runs (ended_at = null) represent a currently-
-- running timer. Closing the run sets ended_at. This replaces the
-- ephemeral in-memory activeTimer state and lets team admins see live
-- timers via the "Tracking now" feed.
alter table public.user_runs alter column ended_at drop not null;

-- Existing RLS had INSERT + SELECT only. Upsert needs UPDATE for the
-- close-run transition (same row, ended_at flips from null to a value).
create policy "user_runs_update_own"
on public.user_runs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

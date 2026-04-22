-- ============================================================
-- Billing tables for Stripe integration
-- ------------------------------------------------------------
-- Three tables cover everything we need:
--
--  subscriptions   one row per Stripe subscription (keyed by Stripe's sub_ id)
--  entitlements    one row per user, written by the webhook — the single
--                  source of truth the frontend reads to decide "is this
--                  user allowed into the app?"
--  webhook_events  idempotency log so a replayed Stripe event never
--                  double-processes
--
-- Everything is written by the stripe-webhook edge function using the
-- service role key (which bypasses RLS). Users only have read access to
-- their own rows via the policies at the bottom of this file.
-- ============================================================

-- ------------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  id                    text primary key,                     -- Stripe sub id (sub_...)
  user_id               uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id    text not null,
  stripe_price_id       text not null,
  plan                  text not null,                        -- 'individual' | 'team'
  "interval"            text not null,                        -- 'month' | 'year'
  status                text not null,                        -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | ...
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  trial_end             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

-- ------------------------------------------------------------
-- entitlements
-- ------------------------------------------------------------
-- One row per user. plan='none' means no active subscription (show paywall).
-- stripe_customer_id is populated on first checkout so future sessions can
-- reuse the existing customer instead of creating a new one.
create table if not exists public.entitlements (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  plan                text not null default 'none',           -- 'none' | 'individual' | 'team'
  subscription_id     text references public.subscriptions(id) on delete set null,
  stripe_customer_id  text,
  source              text not null default 'stripe',         -- 'stripe' | 'manual' | 'gift'
  features            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists entitlements_stripe_customer_id_idx
  on public.entitlements(stripe_customer_id);

-- ------------------------------------------------------------
-- webhook_events (idempotency log)
-- ------------------------------------------------------------
create table if not exists public.webhook_events (
  id            text primary key,                             -- Stripe event id (evt_...)
  type          text not null,
  processed_at  timestamptz not null default now()
);

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table public.subscriptions  enable row level security;
alter table public.entitlements   enable row level security;
alter table public.webhook_events enable row level security;

-- Users can read their own subscription + entitlement rows.
drop policy if exists "subscriptions_read_own" on public.subscriptions;
create policy "subscriptions_read_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "entitlements_read_own" on public.entitlements;
create policy "entitlements_read_own"
  on public.entitlements for select
  using (auth.uid() = user_id);

-- webhook_events is internal — no user-facing policy. Service role writes,
-- nothing else reads. RLS on with no policy = effectively locked to
-- service_role only.

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

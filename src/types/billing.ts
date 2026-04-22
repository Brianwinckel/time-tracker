// ============================================================
// Billing types — mirrors the subscriptions + entitlements tables
// in supabase/migrations/0001_billing.sql
// ============================================================

export type PlanId = 'individual' | 'team';
export type PlanOrNone = PlanId | 'none';
export type BillingInterval = 'month' | 'year';

/** Subset of Stripe subscription statuses we care about. */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export interface Subscription {
  id: string;                           // Stripe sub id (sub_...)
  user_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  plan: PlanId;
  interval: BillingInterval;
  status: SubscriptionStatus;
  current_period_start: string | null;  // ISO timestamps
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
}

export interface Entitlement {
  user_id: string;
  plan: PlanOrNone;
  subscription_id: string | null;
  stripe_customer_id: string | null;
  source: 'stripe' | 'manual' | 'gift';
  features: Record<string, unknown>;
}

/** Resolved billing state the app uses to make gating decisions. */
export interface ResolvedEntitlements {
  plan: PlanOrNone;
  hasActiveSubscription: boolean;
  subscription: Subscription | null;
  entitlement: Entitlement | null;
}

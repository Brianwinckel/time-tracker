// ============================================================
// Billing types — mirror the real Supabase tables.
//
// Schema uses a normalized model:
//   billing_customers  stripe customer id scoped to user OR team
//   subscriptions      keyed by internal UUID; FKs to billing_customers
//   entitlements       per-user resolved plan; FKs to subscriptions
//
// The current paid tier is 'individual'. 'pro' remains reserved
// for the future AI-powered tier. 'free' is a legacy value that
// still exists on some rows but new signups never land there.
// ============================================================

export type PlanId = 'individual' | 'pro' | 'team';
export type PlanOrNone = PlanId | 'free' | 'none';
export type BillingInterval = 'month' | 'year';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type EntitlementSource = 'default' | 'subscription' | 'team_membership' | 'override';

/** Maps to public.subscriptions. Note `id` is internal UUID, NOT the Stripe sub id. */
export interface Subscription {
  id: string;                          // internal UUID PK
  billing_customer_id: string;         // FK to billing_customers.id
  stripe_subscription_id: string;      // Stripe sub_...
  stripe_price_id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  quantity: number;
}

/** Maps to public.entitlements. One row per user. */
export interface Entitlement {
  id: string;
  user_id: string;
  plan: PlanOrNone;                    // DB allows 'free' | 'individual' | 'pro' | 'team'
  source: EntitlementSource;
  subscription_id: string | null;      // FK to subscriptions.id
  valid_until: string | null;
  features: Record<string, unknown>;
}

/** Resolved billing state the app uses to decide app-vs-paywall. */
export interface ResolvedEntitlements {
  plan: PlanOrNone;
  hasActiveSubscription: boolean;
  subscription: Subscription | null;
  entitlement: Entitlement | null;
}

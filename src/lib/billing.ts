// ============================================================
// Billing constants — plan metadata + Stripe price helpers.
// One source of truth for what each plan costs and includes.
// ============================================================

import type { PlanId, BillingInterval } from '../types/billing';

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;   // USD dollars
  yearlyPrice: number;    // USD dollars per year
  yearlyMonthlyEquivalent: number; // yearly / 12, rounded
  features: string[];
  /** When true, checkout is disabled — used for tiers that aren't built yet. */
  comingSoon?: boolean;
}

export const PLANS: Record<PlanId, PlanDef> = {
  individual: {
    id: 'individual',
    name: 'Individual',
    tagline: 'Everything you need to track your day and prove your impact.',
    monthlyPrice: 12,
    yearlyPrice: 115,
    yearlyMonthlyEquivalent: 10,
    features: [
      'Unlimited panels',
      'Full daily summaries',
      'Performance Reviews with any date range',
      'Blockers, follow-ups & unrealized effort',
      'Email & PDF exports',
      'Archive of past daily reports',
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    tagline: 'For teams that want better updates without more meetings.',
    monthlyPrice: 9,
    yearlyPrice: 86,
    yearlyMonthlyEquivalent: 7,
    features: [
      'Everything in Individual',
      'Manager dashboard',
      'Team visibility',
      'Shared rollups',
      'Admin controls',
    ],
    comingSoon: true,
  },
};

export function formatPrice(plan: PlanDef, interval: BillingInterval): string {
  if (interval === 'year') return `$${plan.yearlyMonthlyEquivalent}`;
  return `$${plan.monthlyPrice}`;
}

export function periodLabel(plan: PlanDef, interval: BillingInterval): string {
  if (plan.id === 'team') return '/seat/mo';
  return interval === 'year' ? '/mo, billed yearly' : '/mo';
}

// ============================================================
// Plan definitions, pricing, and feature matrix
// Single source of truth for what each tier includes
// ============================================================

import type { PlanId, FeatureKey } from '../types';

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;   // cents
  yearlyPrice: number;    // cents (total per year)
  features: Record<FeatureKey, boolean | number>;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Try the workflow',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: {
      unlimited_panels: false,
      max_custom_panels: 5,
      history_days: 7,
      daily_summary_basic: true,
      daily_summary_full: false,
      blocker_tracking: false,
      passoff_tracking: false,
      unrealized_effort: false,
      weekly_reports: false,
      exports: false,
      email_tools: false,
      manager_dashboard: false,
      team_visibility: false,
      shared_rollups: false,
      admin_controls: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Full work visibility',
    monthlyPrice: 1200,   // $12
    yearlyPrice: 12000,   // $120
    features: {
      unlimited_panels: true,
      max_custom_panels: 999,
      history_days: 365,
      daily_summary_basic: true,
      daily_summary_full: true,
      blocker_tracking: true,
      passoff_tracking: true,
      unrealized_effort: true,
      weekly_reports: true,
      exports: true,
      email_tools: true,
      manager_dashboard: false,
      team_visibility: false,
      shared_rollups: false,
      admin_controls: false,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    tagline: 'Better updates, fewer meetings',
    monthlyPrice: 900,    // $9/seat
    yearlyPrice: 9000,    // $90/seat/year
    features: {
      unlimited_panels: true,
      max_custom_panels: 999,
      history_days: 365,
      daily_summary_basic: true,
      daily_summary_full: true,
      blocker_tracking: true,
      passoff_tracking: true,
      unrealized_effort: true,
      weekly_reports: true,
      exports: true,
      email_tools: true,
      manager_dashboard: true,
      team_visibility: true,
      shared_rollups: true,
      admin_controls: true,
    },
  },
};

/** Human-readable feature labels for UI */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  unlimited_panels: 'Unlimited task panels',
  max_custom_panels: 'Custom panels',
  history_days: 'History access',
  daily_summary_basic: 'Basic daily summary',
  daily_summary_full: 'Full daily summary with value breakdown',
  blocker_tracking: 'Blocker & pass-off tracking',
  passoff_tracking: 'Handoff & follow-up workflows',
  unrealized_effort: 'Unrealized effort reporting',
  weekly_reports: 'Weekly summary reports',
  exports: 'CSV & text exports',
  email_tools: 'Email summary tools',
  manager_dashboard: 'Manager dashboard',
  team_visibility: 'Team visibility',
  shared_rollups: 'Shared team rollups',
  admin_controls: 'Admin controls',
};

/** Which plan to suggest upgrading to for a given feature */
export function getUpgradePlan(feature: FeatureKey): PlanId {
  if (PLANS.pro.features[feature]) return 'pro';
  return 'team';
}

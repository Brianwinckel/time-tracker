// ============================================================
// Central entitlement resolver and hooks
// All feature gating decisions go through here
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { PLANS } from './plans';
import type { PlanId, FeatureKey, Entitlement, ResolvedEntitlements, Subscription } from '../types';

// ---- Pure resolver ----

const FREE_FEATURES = PLANS.free.features;

export function resolveFromEntitlement(
  entitlement: Entitlement | null,
  subscription?: Subscription | null,
): ResolvedEntitlements {
  if (!entitlement) {
    return { plan: 'free', features: { ...FREE_FEATURES }, source: 'default' };
  }

  const plan = entitlement.plan as PlanId;
  const planDef = PLANS[plan];

  // Use features from the entitlement row (set by webhook), falling back to plan defaults
  const features = { ...planDef.features };
  if (entitlement.features && typeof entitlement.features === 'object') {
    for (const [key, val] of Object.entries(entitlement.features)) {
      if (key in features) {
        (features as Record<string, boolean | number>)[key] = val as boolean | number;
      }
    }
  }

  return {
    plan,
    features: features as Record<FeatureKey, boolean | number>,
    source: entitlement.source,
    subscription: subscription ?? undefined,
    trialEndsAt: subscription?.trial_end ?? undefined,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? undefined,
  };
}

// ---- Helper functions ----

export function canUseFeature(features: Record<string, boolean | number>, key: FeatureKey): boolean {
  const val = features[key];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;
  return false;
}

export function getFeatureLimit(features: Record<string, boolean | number>, key: FeatureKey): number {
  const val = features[key];
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? Infinity : 0;
  return 0;
}

// ---- Entitlements Context (single query, shared across components) ----

interface EntitlementsContextType {
  entitlements: ResolvedEntitlements;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_ENTITLEMENTS: ResolvedEntitlements = {
  plan: 'free',
  features: { ...FREE_FEATURES },
  source: 'default',
};

const EntitlementsContext = createContext<EntitlementsContextType | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState<ResolvedEntitlements>(DEFAULT_ENTITLEMENTS);
  const [loading, setLoading] = useState(true);

  const fetchEntitlements = useCallback(async () => {
    if (!user?.id) {
      setEntitlements(DEFAULT_ENTITLEMENTS);
      setLoading(false);
      return;
    }

    try {
      const { data: ent } = await supabase
        .from('entitlements')
        .select('*')
        .eq('user_id', user.id)
        .single();

      let sub: Subscription | null = null;
      if (ent?.subscription_id) {
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('id', ent.subscription_id)
          .single();
        sub = subData as Subscription | null;
      }

      setEntitlements(resolveFromEntitlement(ent as Entitlement | null, sub));
    } catch (err) {
      console.error('Failed to fetch entitlements:', err);
      setEntitlements(DEFAULT_ENTITLEMENTS);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  return React.createElement(EntitlementsContext.Provider, {
    value: { entitlements, loading, refresh: fetchEntitlements },
    children,
  });
}

// ---- React hook (reads from shared context) ----

export function useEntitlements(): EntitlementsContextType {
  const ctx = useContext(EntitlementsContext);
  // Fallback for components outside the provider (e.g. during auth)
  if (!ctx) {
    return { entitlements: DEFAULT_ENTITLEMENTS, loading: false, refresh: async () => {} };
  }
  return ctx;
}

/** Convenience hook for a single feature gate */
export function useFeatureGate(key: FeatureKey): {
  allowed: boolean;
  limit: number;
  currentPlan: PlanId;
  upgradeTo: PlanId;
} {
  const { entitlements } = useEntitlements();
  const allowed = canUseFeature(entitlements.features, key);
  const limit = getFeatureLimit(entitlements.features, key);
  const upgradeTo = !allowed
    ? (PLANS.pro.features[key] ? 'pro' as PlanId : 'team' as PlanId)
    : entitlements.plan;

  return { allowed, limit, currentPlan: entitlements.plan, upgradeTo };
}

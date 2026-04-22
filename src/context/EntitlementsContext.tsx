// ============================================================
// Entitlements context — reads billing state from Supabase and
// exposes it to the rest of the app.
//
// The AppGate in App.tsx uses this to decide: signed-in user with
// an active subscription → show the app; signed-in without one →
// show the paywall.
//
// The provider also handles the post-checkout race: when a user
// returns from Stripe Checkout with ?checkout=success, the webhook
// may not have finished writing entitlements yet. We poll for up
// to ~15s on mount in that case instead of flashing the paywall.
// ============================================================

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type {
  ResolvedEntitlements, Entitlement, Subscription, PlanId, PlanOrNone,
} from '../types/billing';

interface EntitlementsContextValue {
  entitlements: ResolvedEntitlements;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT: ResolvedEntitlements = {
  plan: 'none',
  hasActiveSubscription: false,
  subscription: null,
  entitlement: null,
};

const Context = createContext<EntitlementsContextValue>({
  entitlements: DEFAULT,
  loading: true,
  refresh: async () => { /* noop */ },
});

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing']);
const PAID_PLANS: ReadonlySet<PlanOrNone> = new Set<PlanOrNone>(['individual', 'pro', 'team']);

async function fetchEntitlements(userId: string): Promise<ResolvedEntitlements> {
  const { data: entRow } = await supabase
    .from('entitlements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  let subRow: Subscription | null = null;
  if (entRow?.subscription_id) {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', entRow.subscription_id)
      .maybeSingle();
    subRow = (data as Subscription | null) ?? null;
  }

  const entitlement = (entRow as Entitlement | null) ?? null;
  // Gate on the combination: sub must exist, be active, AND the
  // entitlement must name a real paid tier. Without all three we
  // route to the paywall.
  const hasActive = !!subRow
    && ACTIVE_STATUSES.has(subRow.status)
    && !!entitlement
    && PAID_PLANS.has(entitlement.plan);

  return {
    plan: hasActive ? (entitlement!.plan as PlanId) : 'none',
    hasActiveSubscription: hasActive,
    subscription: subRow,
    entitlement,
  };
}

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [entitlements, setEntitlements] = useState<ResolvedEntitlements>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const pollTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setEntitlements(DEFAULT);
      setLoading(false);
      return;
    }
    try {
      const ent = await fetchEntitlements(user.id);
      setEntitlements(ent);
    } catch (err) {
      console.error('Failed to fetch entitlements:', err);
      setEntitlements(DEFAULT);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Kick off an initial load + subscribe to user changes.
  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  // Post-checkout race: if we arrive with ?checkout=success and the
  // entitlement isn't active yet, poll every 1.5s up to 15s. The
  // webhook usually lands within a second or two but we give it a
  // generous ceiling.
  useEffect(() => {
    if (!user || loading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success') return;
    if (entitlements.hasActiveSubscription) return;

    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const ent = await fetchEntitlements(user.id);
      if (ent.hasActiveSubscription || attempts >= 10) {
        setEntitlements(ent);
        if (pollTimerRef.current) {
          window.clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        return;
      }
      pollTimerRef.current = window.setTimeout(tick, 1500);
    };
    pollTimerRef.current = window.setTimeout(tick, 1500);

    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [user, loading, entitlements.hasActiveSubscription]);

  // Refresh when the window regains focus (covers the "user left to the
  // portal, canceled their sub, came back" case).
  useEffect(() => {
    const onFocus = () => { if (user) refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refresh]);

  return (
    <Context.Provider value={{ entitlements, loading, refresh }}>
      {children}
    </Context.Provider>
  );
}

export function useEntitlements(): EntitlementsContextValue {
  return useContext(Context);
}

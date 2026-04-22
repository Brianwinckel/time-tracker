// ============================================================
// App — auth gate + paywall gate + cloud hydration + the new V6
// TaskPanelsApp.
//
// Flow:
//   1. Not authed              → AuthScreen
//   2. Authed, no active sub   → PaywallScreen (Stripe Checkout)
//   3. Authed + active sub     → hydrate cloud state → TaskPanelsApp
//
// The hydration step briefly blocks rendering so TaskPanelsApp reads
// localStorage that was just synced from Supabase — avoiding a flash
// where stale local data renders then gets overwritten.
//
// TaskPanelsApp handles new-user vs returning on checkout return:
// if onboarding hasn't been completed, it routes to the onboarding
// screen; otherwise straight to home.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EntitlementsProvider, useEntitlements } from './context/EntitlementsContext';
import { AuthScreen } from './components/AuthScreen';
import { PaywallScreen } from './components/PaywallScreen';
import { TaskPanelsApp, type TaskPanelsAuthUser } from './components/TaskPanelsApp';
import { TaskPanelsLogo } from './components/TaskPanelsLogo';
import { hydrateFromCloud, type StorageModule } from './lib/cloudState';
import type { AuthProvider as ProfileAuthProvider } from './lib/profile';
import { loadProfile } from './lib/profile';
import { loadPreferences } from './lib/preferences';
import { loadOnboarding } from './lib/onboarding';
import { loadBreakDurations } from './lib/breakDefaults';
import { loadCatalog } from './lib/panelCatalog';

// Modules we sync through the user_state JSON-blob table. Normalizers
// just round-trip through the module's own loader to get default-filled,
// validated values back — anything the loader rejects falls back through.
const CLOUD_MODULES: StorageModule<unknown>[] = [
  {
    storageKey: 'taskpanels.profile.v1',
    stateKey: 'profile',
    normalize: (raw) => {
      try {
        localStorage.setItem('taskpanels.profile.v1', JSON.stringify(raw));
        return loadProfile();
      } catch { return null; }
    },
  },
  {
    storageKey: 'taskpanels.preferences.v1',
    stateKey: 'preferences',
    normalize: (raw) => {
      try {
        localStorage.setItem('taskpanels.preferences.v1', JSON.stringify(raw));
        return loadPreferences();
      } catch { return null; }
    },
  },
  {
    storageKey: 'taskpanels.onboarding.v1',
    stateKey: 'onboarding',
    normalize: (raw) => {
      try {
        localStorage.setItem('taskpanels.onboarding.v1', JSON.stringify(raw));
        return loadOnboarding();
      } catch { return null; }
    },
  },
  {
    storageKey: 'taskpanels.breakDefaults.v1',
    stateKey: 'break_defaults',
    normalize: (raw) => {
      try {
        localStorage.setItem('taskpanels.breakDefaults.v1', JSON.stringify(raw));
        return loadBreakDurations();
      } catch { return null; }
    },
  },
  {
    storageKey: 'taskpanels.catalog.v1',
    stateKey: 'catalog',
    normalize: (raw) => {
      try {
        localStorage.setItem('taskpanels.catalog.v1', JSON.stringify(raw));
        return loadCatalog();
      } catch { return null; }
    },
  },
];

// Auth + paywall + cloud-hydration gate.
const AppGate: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { entitlements, loading: entLoading } = useEntitlements();
  const [hydrating, setHydrating] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Pull identity out of Supabase's user into the shape TaskPanelsApp
  // expects. Google OAuth surfaces full_name + avatar_url under
  // user_metadata; email-OTP users only have user.email. user_metadata
  // keys vary slightly by provider, so we fall back through the common
  // variants (full_name → name, avatar_url → picture).
  const authUser = useMemo<TaskPanelsAuthUser | null>(() => {
    if (!user) return null;
    const md = (user.user_metadata ?? {}) as Record<string, unknown>;
    const appMd = (user.app_metadata ?? {}) as Record<string, unknown>;
    const pickString = (...keys: string[]): string | null => {
      for (const k of keys) {
        const v = md[k];
        if (typeof v === 'string' && v.trim()) return v;
      }
      return null;
    };
    const provider: ProfileAuthProvider =
      appMd.provider === 'google' ? 'google' : user ? 'email' : 'none';
    return {
      name: pickString('full_name', 'name'),
      email: user.email ?? pickString('email'),
      avatarUrl: pickString('avatar_url', 'picture'),
      provider,
    };
  }, [user]);

  // When the user becomes known (and has an active sub), hydrate the
  // JSON-blob state from Supabase. This writes to localStorage; after
  // it resolves TaskPanelsApp mounts and reads fresh local state.
  useEffect(() => {
    if (!user) {
      setHydratedFor(null);
      return;
    }
    if (hydratedFor === user.id) return;
    if (!entitlements.hasActiveSubscription) return;

    let cancelled = false;
    setHydrating(true);
    hydrateFromCloud(user.id, CLOUD_MODULES)
      .catch(err => console.error('[App] hydrateFromCloud threw:', err))
      .finally(() => {
        if (cancelled) return;
        setHydrating(false);
        setHydratedFor(user.id);
      });
    return () => { cancelled = true; };
  }, [user, entitlements.hasActiveSubscription, hydratedFor]);

  // Show the breathing loader while any gate is still resolving.
  const stillResolving = authLoading || (user && entLoading) ||
    (user && entitlements.hasActiveSubscription && hydrating);
  if (stillResolving) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-white gap-4">
        <TaskPanelsLogo size={72} animated />
        <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
          TaskPanels
        </span>
      </div>
    );
  }

  // Not logged in — show login screen.
  if (!user) return <AuthScreen />;

  // Logged in but no active subscription — show the paywall.
  if (!entitlements.hasActiveSubscription) return <PaywallScreen />;

  // Fully authenticated + paid + hydrated — show the app.
  return <TaskPanelsApp authUser={authUser} />;
};

function App() {
  return (
    <AuthProvider>
      <EntitlementsProvider>
        <AppGate />
      </EntitlementsProvider>
    </AuthProvider>
  );
}

export default App;

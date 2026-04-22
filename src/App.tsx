// ============================================================
// App — auth gate + paywall gate + the new V6 TaskPanelsApp.
//
// Flow:
//   1. Not authed           → AuthScreen
//   2. Authed, no active sub → PaywallScreen (Stripe Checkout)
//   3. Authed + active sub   → TaskPanelsApp
//
// TaskPanelsApp handles the new-user vs returning distinction on
// checkout return: if onboarding hasn't been completed, it routes
// to the onboarding screen; otherwise straight to home.
// ============================================================

import React, { useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EntitlementsProvider, useEntitlements } from './context/EntitlementsContext';
import { AuthScreen } from './components/AuthScreen';
import { PaywallScreen } from './components/PaywallScreen';
import { TaskPanelsApp, type TaskPanelsAuthUser } from './components/TaskPanelsApp';
import { TaskPanelsLogo } from './components/TaskPanelsLogo';
import type { AuthProvider as ProfileAuthProvider } from './lib/profile';

// Auth + paywall gate.
const AppGate: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { entitlements, loading: entLoading } = useEntitlements();

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

  // Show the breathing loader while either gate is still resolving.
  // For signed-out users we skip the entitlement wait since there's
  // nothing to look up.
  const stillResolving = authLoading || (user && entLoading);
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

  // Fully authenticated + paid — show the app.
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

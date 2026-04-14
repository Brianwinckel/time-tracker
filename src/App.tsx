// ============================================================
// App — auth gate + the new V6 TaskPanelsApp.
//
// The legacy AppProvider / AppShell / Dashboard / Settings etc.
// are intentionally no longer mounted here. All state and
// routing lives inside <TaskPanelsApp />, backed by localStorage.
// This file also bridges Supabase's authenticated user into
// TaskPanelsApp's profile state so the identity card picks up
// name + email + Google avatar on first sign-in.
// ============================================================

import React, { useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { TaskPanelsApp, type TaskPanelsAuthUser } from './components/TaskPanelsApp';
import { TaskPanelsLogo } from './components/TaskPanelsLogo';
import type { AuthProvider as ProfileAuthProvider } from './lib/profile';

// Auth gate — only checks login state. A user doesn't need a team_id
// to use TaskPanels — this is a personal time tracker first.
const AuthGate: React.FC = () => {
  const { user, loading } = useAuth();

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

  // Still checking auth state — show the breathing brand mark instead
  // of a "Loading..." text blob.
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-white gap-4">
        <TaskPanelsLogo size={72} animated />
        <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
          TaskPanels
        </span>
      </div>
    );
  }

  // Not logged in — show login screen
  if (!user) {
    return <AuthScreen />;
  }

  // Fully authenticated — show the app, seeded with the Google/email
  // identity so the profile card + sidebar avatar pick it up.
  return <TaskPanelsApp authUser={authUser} />;
};

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;

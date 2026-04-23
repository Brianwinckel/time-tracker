// ============================================================
// Auth context — session tracking, profile loading, team join
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { setCloudStateUser, clearLocalUserState } from '../lib/cloudState';

// localStorage marker so we can detect when the signed-in user changes
// across page loads (e.g. sign out, then sign in as a different user).
const LAST_USER_ID_KEY = 'taskpanels.__lastUserId';

function readLastUserId(): string | null {
  try { return localStorage.getItem(LAST_USER_ID_KEY); } catch { return null; }
}
function writeLastUserId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_USER_ID_KEY, id);
    else localStorage.removeItem(LAST_USER_ID_KEY);
  } catch { /* ignore quota/privacy-mode errors */ }
}
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  name: string;
  team_id: string | null;
  department_id: string | null;
  team_role: 'owner' | 'admin' | 'member';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the user's profile from the profiles table
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch profile:', error.message);
      return null;
    }
    return data as Profile;
  }, []);

  // Refresh profile (called after team selection, etc.)
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (p) setProfile(p);
  }, [user, fetchProfile]);

  // Update profile fields
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Failed to update profile:', error.message);
      return;
    }
    await refreshProfile();
  }, [user, refreshProfile]);

  // Initialize: check existing session.
  //
  // Two defensive choices that matter in production:
  //
  //  1. We don't block `loading` on the profile fetch. The app only
  //     needs to know "is there a user?" to decide between auth-screen
  //     and app-shell. The profile is supplementary; hydrate it in the
  //     background. Without this, a flaky Supabase query to `profiles`
  //     pins the breathing-logo loader forever.
  //
  //  2. A 5-second safety ceiling force-flips `loading` to false even
  //     if `getSession()` itself hangs. Better to show the auth screen
  //     (and let the user retry) than to spin indefinitely.
  useEffect(() => {
    let cancelled = false;

    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    // Claim any pending team invite, then fetch the profile so the UI
    // sees the joined team. We always try the RPC — it's a cheap no-op
    // when the user already has a team_id or no invite exists.
    const hydrateProfile = async (userId: string) => {
      try {
        await supabase.rpc('accept_pending_team_invite');
      } catch (err) {
        console.warn('[auth] accept_pending_team_invite failed:', err);
      }
      const p = await fetchProfile(userId);
      if (!cancelled) setProfile(p);
    };

    // If the signed-in user differs from whoever last used this browser,
    // nuke their localStorage before we touch any cloud-state machinery.
    // Without this, hydrateFromCloud() for a brand-new user would see
    // leftover local data and upload it into the new user's cloud row.
    const onSignedIn = (userId: string) => {
      const prev = readLastUserId();
      if (prev && prev !== userId) clearLocalUserState();
      writeLastUserId(userId);
      setCloudStateUser(userId);
    };

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          onSignedIn(session.user.id);
          setUser(session.user);
          hydrateProfile(session.user.id);
        }
      } catch (err) {
        console.error('Failed to get session:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();

    // Listen for auth changes (magic link callback, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        if (cancelled) return;
        if (session?.user) {
          onSignedIn(session.user.id);
          setUser(session.user);
          hydrateProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setCloudStateUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign in with magic link
  const signIn = useCallback(async (email: string) => {
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    return { error: error?.message ?? null };
  }, []);

  // Verify the 6-digit code from either the signup-confirmation or
  // magic-link email. In Supabase v2 `type: 'email'` accepts both.
  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    return { error: error?.message ?? null };
  }, []);

  // Sign in with Google OAuth
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  }, []);

  // Sign out — wipe local state *before* Supabase clears the session so
  // nothing stale leaks into the next user on this browser.
  const signOut = useCallback(async () => {
    clearLocalUserState();
    writeLastUserId(null);
    setCloudStateUser(null);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const contextValue = useMemo(() => ({
    user, profile, loading, signIn, verifyOtp, signInWithGoogle,
    signOut, refreshProfile, updateProfile,
  }), [user, profile, loading, signIn, verifyOtp, signInWithGoogle,
    signOut, refreshProfile, updateProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/** Soft variant — returns null when no AuthProvider is mounted
 *  (preview.tsx harness). Screens that can render a sensible
 *  logged-out fallback should use this instead of useAuth(). */
export function useAuthOptional(): AuthContextType | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ============================================================
// Auth context — session tracking, profile loading, team join
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { flushPendingWrites } from '../storage';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'employee' | 'manager' | 'admin';
  team_id: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
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

    const hydrateProfile = (userId: string) => {
      fetchProfile(userId).then(p => {
        if (!cancelled) setProfile(p);
      });
    };

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
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
          setUser(session.user);
          hydrateProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
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

  // Verify OTP code (email 2FA)
  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    return { error: error?.message ?? null };
  }, []);

  // Sign in with email + password
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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

  // Sign up with email + password
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  }, []);

  // Send password reset email
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=true`,
    });
    return { error: error?.message ?? null };
  }, []);

  // Update password (after reset link click)
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }, []);

  // Sign out — flush pending data first
  const signOut = useCallback(async () => {
    await flushPendingWrites();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const contextValue = useMemo(() => ({
    user, profile, loading, signIn, verifyOtp, signInWithPassword,
    signInWithGoogle, signUp, resetPassword, updatePassword,
    signOut, refreshProfile, updateProfile,
  }), [user, profile, loading, signIn, verifyOtp, signInWithPassword,
    signInWithGoogle, signUp, resetPassword, updatePassword,
    signOut, refreshProfile, updateProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

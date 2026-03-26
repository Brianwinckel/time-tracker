// ============================================================
// Supabase client — single instance, shared across the app
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Resolved app URL for Supabase auth redirects.
 * Uses VITE_APP_URL (should match the Site URL / Redirect URLs configured
 * in the Supabase dashboard) so emails always link to the correct origin,
 * falling back to window.location.origin for local development.
 */
export const getAppUrl = (): string =>
  import.meta.env.VITE_APP_URL || window.location.origin;

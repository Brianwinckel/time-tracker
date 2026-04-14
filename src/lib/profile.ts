// ============================================================
// User Profile — "My account" data
// ------------------------------------------------------------
// Owns the user's identity in the app: name, email, role,
// avatar (base64 data URL or null → fallback to initials),
// and the default audience that pre-fills the prepare-summary
// screen. Persisted to localStorage as `taskpanels.profile.v1`.
//
// This is intentionally separate from Settings (which owns
// "how the app works"). Profile owns "who I am".
// ============================================================

/** How the user is currently authenticated. Drives which avatar source
 *  the app prefers when rendering — uploaded photos always win, but a
 *  Google sign-in supplies a remote URL as the next-best fallback. */
export type AuthProvider = 'none' | 'email' | 'google';

export interface UserProfile {
  name: string;
  email: string;
  /** What the user does — feeds onboarding presets and tone hints. */
  role: string;
  /** Optional default audience for daily summaries (e.g. "Sarah, my manager"). */
  defaultAudience: string;
  /** Base64 data URL for an uploaded avatar image. Highest-priority source. */
  avatarDataUrl: string | null;
  /** Remote photo URL supplied by an SSO provider (e.g. Google's `picture`
   *  claim). Used when the user hasn't uploaded their own photo. */
  ssoAvatarUrl: string | null;
  /** Which provider the user signed in with, if any. */
  authProvider: AuthProvider;
}

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  email: '',
  role: '',
  defaultAudience: '',
  avatarDataUrl: null,
  ssoAvatarUrl: null,
  authProvider: 'none',
};

const STORAGE_KEY = 'taskpanels.profile.v1';

export function loadProfile(): UserProfile {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      name: parsed.name ?? '',
      email: parsed.email ?? '',
      role: parsed.role ?? '',
      defaultAudience: parsed.defaultAudience ?? '',
      avatarDataUrl: parsed.avatarDataUrl ?? null,
      ssoAvatarUrl: parsed.ssoAvatarUrl ?? null,
      authProvider: parsed.authProvider ?? 'none',
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

/** Two-letter initials from a name. Returns empty string if no name. */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Pick the best avatar source for rendering.
 *  Priority: uploaded photo → SSO photo (e.g. Google) → null (initials/icon). */
export function resolveAvatarUrl(profile: UserProfile): string | null {
  if (profile.avatarDataUrl) return profile.avatarDataUrl;
  if (profile.ssoAvatarUrl) return profile.ssoAvatarUrl;
  return null;
}

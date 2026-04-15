// ============================================================
// ProfileScreen — "My Account" surface
// ------------------------------------------------------------
// Cleaved off Settings as part of the IA refinement: this owns
// identity (avatar, name, email, role), the user-specific summary
// default audience, plan/billing, and Sign Out. Settings is now
// strictly about how the app *works*; this is about who you are.
//
// Plan & Billing is a placeholder: launch is free-only, so we
// don't show a "Free Plan" card — just a row list with Manage
// Subscription / Payment Method / Invoices marked "Soon" so the
// slot is reserved for future subscription work.
//
// Keeps the same SettingsShell visual language so it doesn't feel
// like a different product.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { useNav } from '../../lib/previewNav';
import { AvatarBadge } from '../AvatarBadge';

export const ProfileScreen: React.FC = () => {
  const { navigate, userProfile, updateProfile } = useNav();
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Local draft form state — committed on Save so we can show a
  // "Saved ✓" flash and not bloat localStorage on every keystroke.
  const [draft, setDraft] = useState(userProfile);
  const [savedFlash, setSavedFlash] = useState(false);
  useEffect(() => {
    setDraft(userProfile);
  }, [userProfile]);

  const dirty =
    draft.name !== userProfile.name ||
    draft.email !== userProfile.email ||
    draft.role !== userProfile.role ||
    draft.defaultAudience !== userProfile.defaultAudience;

  const handleSave = () => {
    updateProfile({
      name: draft.name.trim(),
      email: draft.email.trim(),
      role: draft.role.trim(),
      defaultAudience: draft.defaultAudience.trim(),
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateProfile({ avatarDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
    // Allow re-picking the same file later.
    e.target.value = '';
  };

  const handleAvatarRemove = () => {
    updateProfile({ avatarDataUrl: null });
  };

  const handleSignOut = () => {
    window.alert('Sign out is wired up in the production build.');
  };

  // Walk the user back through the welcome → role → panels → audience
  // → ready flow. Panel instances on home are stored independently of
  // the catalog, so re-running onboarding only replaces the *templates*
  // you can pick from — your live panels, tracked runs, projects, and
  // profile stay put. We still prompt so the user isn't surprised when
  // their starter catalog looks different afterwards.
  const handleRerunSetup = () => {
    const ok = window.confirm(
      'Re-run setup? You\'ll walk through the welcome flow again to pick a new role and starter panels. This replaces your panel template list but leaves your tracked time, projects, and profile details alone.',
    );
    if (!ok) return;
    navigate('onboarding');
  };

  // Hard cache purge + reload. The offline-first service worker caches
  // the app shell, which means iOS standalone PWAs can keep showing a
  // stale bundle after a deploy until the user force-quits the window.
  // This button is the user-visible escape hatch: unregister every SW,
  // nuke every Cache Storage entry, then reload against the network.
  // Tracked time, projects, catalog, and profile live in localStorage
  // and are NOT touched — we're only flushing the network shell cache.
  const handleRefreshApp = async () => {
    const ok = window.confirm(
      'Refresh app? This clears the offline cache and reloads to pull the latest version. Your tracked time, projects, and profile details are safe.',
    );
    if (!ok) return;
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {
      /* best effort — reload anyway so at least the page re-fetches */
    }
    window.location.reload();
  };

  // Simulated Google sign-in. In production this kicks off OAuth and we
  // pull `name`, `email`, and `picture` from the ID token. Here we drop in
  // a deterministic mock photo so the avatar fallback chain is exercisable.
  const handleConnectGoogle = () => {
    const mockGoogleAvatar =
      'https://lh3.googleusercontent.com/a/default-user=s256';
    updateProfile({
      authProvider: 'google',
      ssoAvatarUrl: mockGoogleAvatar,
      // Fill in name/email if the user hasn't set them yet — mirrors what
      // OAuth would give us. We don't clobber existing values.
      name: userProfile.name || 'Google User',
      email: userProfile.email || 'google.user@gmail.com',
    });
  };

  const handleDisconnectGoogle = () => {
    updateProfile({
      authProvider: 'none',
      ssoAvatarUrl: null,
    });
  };

  // Avatar preview reflects the *committed* profile (so removing/
  // replacing the file feels instant) but uses the draft's name for
  // initials so you see updated initials live as you type.
  const previewProfile = {
    ...userProfile,
    name: draft.name,
  };

  // What's actually rendering in the avatar — used for the helper text
  // so the user understands which source they're seeing.
  const hasUploaded = !!userProfile.avatarDataUrl;
  const hasGoogle = userProfile.authProvider === 'google' && !!userProfile.ssoAvatarUrl;
  const avatarSourceLabel = hasUploaded
    ? 'Showing your uploaded photo.'
    : hasGoogle
      ? 'Showing your Google profile photo.'
      : 'Showing your initials. Upload a photo or connect Google to use a real one.';

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300"
            aria-label="Back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">My Account</p>
            <h1 className="text-lg font-bold text-slate-900 truncate">Profile</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        {/* ===== Personal Info card ===== */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <header className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Personal Info</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              How TaskPanels addresses you and tunes its tone.
            </p>
          </header>

          <div className="p-5 space-y-6">
            {/* Avatar row */}
            <div className="flex items-center gap-5">
              <AvatarBadge profile={previewProfile} size="lg" shape="square" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                  >
                    {hasUploaded ? 'Replace photo' : 'Upload photo'}
                  </button>
                  {hasUploaded && (
                    <button
                      type="button"
                      onClick={handleAvatarRemove}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">{avatarSourceLabel}</p>
                <p className="text-[11px] text-slate-400">
                  Priority: uploaded photo → Google photo → initials.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarPick}
                />
              </div>
            </div>

            {/* Form fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Your full name"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={e => setDraft({ ...draft, email: e.target.value })}
                  placeholder="you@work.com"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Role / Work Type
                </span>
                <input
                  type="text"
                  value={draft.role}
                  onChange={e => setDraft({ ...draft, role: e.target.value })}
                  placeholder="e.g. Product Designer, Founder, Engineering Manager"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Default Summary Audience
                  <span className="ml-1 text-slate-400 normal-case font-normal">(optional)</span>
                </span>
                <input
                  type="text"
                  value={draft.defaultAudience}
                  onChange={e => setDraft({ ...draft, defaultAudience: e.target.value })}
                  placeholder="e.g. Sarah, my manager"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Pre-fills the audience field when you generate a daily summary.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              {savedFlash && (
                <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </section>

        {/* ===== Connected Account ===== */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <header className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Connected Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sign in with Google to sync your name, email, and profile photo automatically.
            </p>
          </header>
          <div className="px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Google G mark */}
              <div className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {hasGoogle ? 'Connected to Google' : 'Not connected'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {hasGoogle
                    ? `Signed in as ${userProfile.email || 'your Google account'}`
                    : 'We use your Google profile photo when no upload is set.'}
                </p>
              </div>
            </div>
            {hasGoogle ? (
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg shrink-0"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shrink-0"
              >
                Connect Google
              </button>
            )}
          </div>
          {hasGoogle && hasUploaded && (
            <div className="px-5 pb-4 -mt-1">
              <p className="text-[11px] text-slate-400">
                Your uploaded photo is overriding the Google photo. Remove it to use Google's instead.
              </p>
            </div>
          )}
        </section>

        {/* ===== Plan & Billing =====
             No "Free Plan" card — launch is free-only, so showing a plan
             name would be noise. Instead we park the slot with the three
             rows a future subscription flow will need (Manage, Payment,
             Invoices), all marked Soon. Wire them up when Stripe lands. */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <header className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Plan & Billing</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Subscription, payment method, and invoices.
            </p>
          </header>
          <ul>
            {[
              {
                label: 'Manage Subscription',
                hint: 'Upgrade, downgrade, or cancel your plan',
              },
              { label: 'Payment Method', hint: null },
              { label: 'Invoices', hint: null },
            ].map((item, i, arr) => (
              <li
                key={item.label}
                className={`px-5 py-3 flex items-center justify-between ${
                  i < arr.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 truncate">{item.label}</p>
                  {item.hint && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.hint}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 ml-3">
                  Soon
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ===== Re-run Setup =====
             Escape hatch for users who want to change their role or
             starter panel picks without hand-editing the catalog. Lives
             above Sign Out so "change my setup" and "end my session"
             feel like related account-level actions. */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={handleRerunSetup}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">Re-run Setup</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Walk through the welcome flow again to pick a new role and starter panels.
              </p>
            </div>
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
          </button>
        </section>

        {/* ===== Refresh App =====
             The offline service worker aggressively caches the app
             shell, which means deploys can take a while to surface on
             iOS standalone PWAs. This is the user-visible escape hatch:
             unregister the SW, flush Cache Storage, and reload against
             the network. Sits above Sign Out because both are "reach
             for this when something feels off" account-level actions. */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={handleRefreshApp}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">Refresh App</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Clear the offline cache and reload to pull the latest version.
              </p>
            </div>
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10" />
              <path d="M20.49 15A9 9 0 015.64 18.36L1 14" />
            </svg>
          </button>
        </section>

        {/* ===== Sign Out ===== */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div>
              <p className="text-sm font-semibold text-rose-600">Sign Out</p>
              <p className="text-xs text-slate-500 mt-0.5">End the current session on this device.</p>
            </div>
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </section>
      </main>
    </div>
  );
};

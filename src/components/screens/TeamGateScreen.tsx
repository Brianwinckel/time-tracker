// ============================================================
// TeamGateScreen — paywall preview for the Team plan
// ------------------------------------------------------------
// Linked from both Team nav buttons (desktop sidebar + mobile
// bottom bar). The Team plan isn't shipped yet, so this screen
// stands in for the upgrade flow: it explains what the user
// would get, lists the headline features in a grid, and parks
// a primary CTA where the real checkout handoff will land.
//
// The CTA currently flips to an inline "You're on the list"
// confirmation — swap that for a payment-portal redirect
// (Stripe checkout session, LemonSqueezy, etc.) when billing
// is wired up. The rest of the screen can stay as-is.
// ============================================================

import React, { useState } from 'react';
import { useNav } from '../../lib/previewNav';

// ============================================================
// Icons — kept inline so the file is self-contained. Matches
// the pattern used by the other screen components in this dir.
// ============================================================

const BackArrow = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 19l-7-7 7-7" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const TeamHeroIcon = () => (
  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

// ============================================================
// Feature list — static marketing content. Iconography is
// inline so every tile paints with a distinct accent and we
// don't need a shared icon set.
// ============================================================

interface TeamFeature {
  title: string;
  description: string;
  accentBg: string;
  accentFg: string;
  icon: React.ReactNode;
}

const TEAM_FEATURES: TeamFeature[] = [
  {
    title: 'Shared projects & panels',
    description:
      'Build a team-wide library of projects and panel templates so everyone tracks the same work the same way.',
    accentBg: 'bg-blue-100',
    accentFg: 'text-blue-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    title: 'Team reporting',
    description:
      'Roll up daily, weekly, and performance reports across every teammate into one unified view.',
    accentBg: 'bg-emerald-100',
    accentFg: 'text-emerald-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Roles & permissions',
    description:
      'Managers see the full picture. Contributors see their own work. Guests get scoped read access.',
    accentBg: 'bg-purple-100',
    accentFg: 'text-purple-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'Manager dashboards',
    description:
      'Who is tracking time right now, what are they working on, and what are the blockers — all live.',
    accentBg: 'bg-orange-100',
    accentFg: 'text-orange-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 4 4 5-5" />
      </svg>
    ),
  },
  {
    title: 'Workload visibility',
    description:
      'Spot overworked teammates, idle panels, and meeting-heavy weeks before they become problems.',
    accentBg: 'bg-rose-100',
    accentFg: 'text-rose-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: 'Consolidated billing',
    description:
      'One invoice per team. Seat-based pricing with volume discounts for growing organizations.',
    accentBg: 'bg-teal-100',
    accentFg: 'text-teal-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
];

// ============================================================
// Main screen
// ============================================================

export const TeamGateScreen: React.FC = () => {
  const { navigate } = useNav();
  // Local UI state for the waitlist-stub. When billing lands, the
  // Upgrade button will redirect to Stripe / the payment portal
  // instead of flipping this flag.
  const [notified, setNotified] = useState(false);

  const handleUpgradeClick = () => {
    // TODO(billing): replace with a call to the payment portal —
    // e.g. createCheckoutSession(planId: 'team') → window.location.
    setNotified(true);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      {/* ===== Header ===== */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300"
            aria-label="Back"
          >
            <BackArrow />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Upgrade
            </p>
            <h1 className="text-lg font-bold text-slate-900 truncate">Team</h1>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[10px] font-bold uppercase tracking-wider shrink-0">
            Coming soon
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
        {/* ===== Hero =====
            Dark gradient card so the CTA stands out against the
            slate-50 body. The icon chip is a glass pill over the
            gradient — same treatment as the profile "premium"
            look elsewhere in the app. */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 rounded-2xl p-6 md:p-10 text-white relative overflow-hidden">
          {/* Soft decorative glow in the corner */}
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"
            aria-hidden
          />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center mb-5">
              <TeamHeroIcon />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold mb-2 leading-tight">
              Track work together
            </h2>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-lg mb-6">
              Team brings every teammate's panels, projects, and summaries
              into one shared workspace. Managers see the full picture.
              Contributors stay in flow.
            </p>

            {notified ? (
              <div className="inline-flex items-start gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 text-sm font-semibold max-w-md">
                <span className="text-emerald-300 shrink-0 pt-0.5">
                  <CheckIcon />
                </span>
                <span className="leading-snug">
                  You're on the list. We'll email you the moment Team is ready.
                </span>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={handleUpgradeClick}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 transition-colors shadow-lg shadow-blue-900/20"
                >
                  <LockIcon />
                  Upgrade to Team
                  <ArrowRightIcon />
                </button>
                <p className="text-[11px] text-slate-400 mt-2.5">
                  Launches soon — click to be the first to know.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ===== Feature grid ===== */}
        <section>
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
            What you'll get
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEAM_FEATURES.map(f => (
              <div
                key={f.title}
                className="bg-white rounded-2xl border border-slate-200 p-5"
              >
                <div
                  className={`w-9 h-9 rounded-xl ${f.accentBg} ${f.accentFg} flex items-center justify-center mb-3`}
                >
                  {f.icon}
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  {f.title}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Solo reassurance =====
            Make it obvious that turning on Team is additive — the
            user's current single-player experience isn't taken away
            if they don't upgrade. Prevents "will I lose my stuff?"
            anxiety that kills upgrade conversions. */}
        <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-blue-100 flex items-center justify-center shrink-0 text-blue-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                Using TaskPanels solo?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your current features — panels, projects, summaries, archives
                — stay put. Team is an optional add-on for bringing others
                into your workspace, not a replacement for what you already
                use.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

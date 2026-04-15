// ============================================================
// Settings — "How TaskPanels works"
// ------------------------------------------------------------
// Top-level structure (post IA cleanup):
//   * Preferences   — visual defaults, day view, break/lunch
//   * Notifications — when the app nudges you
//   * Reporting     — summary defaults, email template, daily email
//   * Workspace     — Projects (primary), Panels, Advanced Labels
//   * Advanced      — data export, integrations, reset
//
// "Who I am" lives in ProfileScreen now (avatar, name, email,
// role, default audience, plan/billing, sign out). Settings is
// strictly about how the product behaves.
//
// Most sub-pages are stubs for now. The functional surface in
// this phase is Projects, the new first-class workflow object.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNav } from '../../lib/previewNav';
import type { PreviewScreen } from '../../lib/previewNav';
import { PANEL_COLOR_OPTIONS, colorOptionFor } from '../../lib/panelCatalog';
import { activeProjects, type Project } from '../../lib/projects';
import type { AppPreferences } from '../../lib/preferences';

// ============================================================
// Shared shell
// ============================================================

interface SettingsShellProps {
  title: string;
  /** Optional crumb shown in the header — e.g. parent section. */
  crumb?: { label: string; screen: PreviewScreen };
  /** Where the back button should land. Defaults to settings home. */
  backTo?: PreviewScreen;
  /** Right-side header action (e.g. "+ New Project"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

const SettingsShell: React.FC<SettingsShellProps> = ({ title, crumb, backTo, action, children }) => {
  const { navigate } = useNav();
  const back = backTo ?? 'settings';
  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(back)}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300"
            aria-label="Back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            {crumb && (
              <button
                type="button"
                onClick={() => navigate(crumb.screen)}
                className="text-[11px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-600"
              >
                {crumb.label}
              </button>
            )}
            <h1 className="text-lg font-bold text-slate-900 truncate">{title}</h1>
          </div>
          {action}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">{children}</main>
    </div>
  );
};

// ============================================================
// Settings Home — calm index page
// ============================================================

interface SectionItem {
  label: string;
  screen?: PreviewScreen;
  soon?: boolean;
  emphasis?: boolean;
  /** Click handler for items that open a modal instead of navigating. */
  onClick?: () => void;
  /** Optional secondary line shown under the label. */
  hint?: string;
}

interface SectionDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Items inside this section, rendered as a sub-list on the home page. */
  items: SectionItem[];
}

const SECTION_ICON_BG = 'bg-slate-100 text-slate-600';

interface SectionHandlers {
  openDebug: () => void;
  openFeedback: () => void;
}

const buildSections = (handlers: SectionHandlers): SectionDef[] => [
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Visual defaults and how the tracker behaves',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
    items: [
      { label: 'Appearance', screen: 'settings-appearance' },
      { label: 'Default Day View', screen: 'settings-day-view' },
      { label: 'Break & Lunch Defaults', screen: 'settings-breaks' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'When TaskPanels nudges you',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
    items: [
      { label: 'Notifications', screen: 'settings-notifications' },
    ],
  },
  {
    id: 'reporting',
    title: 'Reporting',
    description: 'Summary behavior and communication defaults',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    items: [
      { label: 'Summary Defaults', screen: 'settings-summary-defaults' },
      { label: 'Email Template', screen: 'settings-email-template' },
      { label: 'Auto Daily Email', screen: 'settings-auto-email' },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace',
    description: 'Structural objects used throughout the product',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    items: [
      { label: 'Projects', screen: 'settings-projects', emphasis: true },
      { label: 'Panels', screen: 'settings-panels' },
      { label: 'Advanced Labels', screen: 'settings-advanced-labels' },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: 'Data, integrations, and developer-style controls',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    items: [
      { label: 'Data Export', soon: true },
      { label: 'Integrations', soon: true },
      { label: 'Reset Workspace', soon: true },
      {
        label: 'Debug',
        onClick: handlers.openDebug,
        hint: 'View app state, storage, and version info',
      },
      {
        label: 'Feature Requests',
        onClick: handlers.openFeedback,
        hint: 'Send us an idea or vote on the roadmap',
      },
    ],
  },
];

type AdvancedModal = null | 'debug' | 'feedback';

const SettingsHome: React.FC = () => {
  const { navigate } = useNav();
  const [modal, setModal] = useState<AdvancedModal>(null);

  const sections = useMemo(
    () =>
      buildSections({
        openDebug: () => setModal('debug'),
        openFeedback: () => setModal('feedback'),
      }),
    [],
  );

  return (
    // Settings home is a top-level destination from the bottom nav, so its
    // back chevron should land you back on the tracker, not loop to itself.
    <SettingsShell title="Settings" backTo="home">
      <p className="text-sm text-slate-500 mb-6">
        How TaskPanels works. For your account, avatar, and billing,
        head to <button type="button" onClick={() => navigate('profile')} className="text-blue-600 hover:text-blue-700 font-semibold underline-offset-2 hover:underline">your profile</button>.
      </p>
      <div className="space-y-4">
        {sections.map(section => (
          <section
            key={section.id}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
          >
            <header className="px-5 pt-5 pb-3 flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${SECTION_ICON_BG} flex items-center justify-center shrink-0`}>
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-slate-900">{section.title}</h2>
                <p className="text-xs text-slate-500 leading-relaxed">{section.description}</p>
              </div>
            </header>
            <ul className="border-t border-slate-100">
              {section.items.map(item => {
                const interactive = Boolean(item.screen) || Boolean(item.onClick);
                const handleClick = () => {
                  if (item.screen) navigate(item.screen);
                  else if (item.onClick) item.onClick();
                };
                return (
                  <li
                    key={item.label}
                    className={`border-b border-slate-100 last:border-b-0 ${
                      interactive ? 'hover:bg-slate-50' : ''
                    }`}
                  >
                    <button
                      type="button"
                      disabled={!interactive}
                      onClick={handleClick}
                      className="w-full px-5 py-3 flex items-center justify-between text-left disabled:cursor-default"
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="min-w-0 flex-1">
                          <span
                            className={`text-sm block truncate ${
                              item.emphasis ? 'font-semibold text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.hint && (
                            <span className="text-[11px] text-slate-400 block truncate">
                              {item.hint}
                            </span>
                          )}
                        </span>
                        {item.emphasis && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                            Primary
                          </span>
                        )}
                        {item.soon && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
                            Soon
                          </span>
                        )}
                      </span>
                      {interactive && (
                        <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {modal === 'debug' && <DebugModal onClose={() => setModal(null)} />}
      {modal === 'feedback' && <FeatureRequestModal onClose={() => setModal(null)} />}
    </SettingsShell>
  );
};

// ============================================================
// Debug modal — surfaces app state for support / troubleshooting
// ============================================================

const APP_VERSION = 'taskpanels v0.6.0-preview';

const DebugModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { panels, panelCatalog, projects, runs, userProfile } = useNav();

  // Snapshot the localStorage keys we own so the user (and support) can
  // see exactly what's persisted. Sizes give a quick "is anything way too
  // big" signal without dumping every byte to the screen.
  const storageRows = useMemo(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const keys = [
      'taskpanels.profile.v1',
      'taskpanels.catalog.v1',
      'taskpanels.panels.v1',
      'taskpanels.runs.v1',
      'taskpanels.projects.v1',
      'taskpanels.onboarding.v1',
    ];
    return keys.map(k => {
      const raw = window.localStorage.getItem(k);
      return {
        key: k,
        present: raw !== null,
        bytes: raw ? new Blob([raw]).size : 0,
      };
    });
  }, []);

  const debugPayload = useMemo(
    () =>
      JSON.stringify(
        {
          version: APP_VERSION,
          generatedAt: new Date().toISOString(),
          counts: {
            panelCatalog: panelCatalog.length,
            panels: panels.length,
            projects: projects.length,
            runs: runs.length,
          },
          profile: {
            hasName: !!userProfile.name,
            hasEmail: !!userProfile.email,
            authProvider: userProfile.authProvider,
            hasUploadedAvatar: !!userProfile.avatarDataUrl,
            hasSsoAvatar: !!userProfile.ssoAvatarUrl,
          },
          storage: storageRows,
          userAgent:
            typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
        },
        null,
        2,
      ),
    [panelCatalog, panels, projects, runs, userProfile, storageRows],
  );

  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused (e.g. permissions) — fall back to selecting the text.
    }
  };

  const handleClearLocalData = () => {
    if (
      !window.confirm(
        'Clear all locally-stored TaskPanels data on this device? This wipes your profile, panels, projects, and runs. The page will reload.',
      )
    ) {
      return;
    }
    for (const row of storageRows) {
      window.localStorage.removeItem(row.key);
    }
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl md:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Debug</h3>
            <p className="text-xs text-slate-500">
              App state, storage, and version info. Useful for bug reports.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>

        <div className="overflow-auto flex-1">
          {/* Quick stats */}
          <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Panels', value: panels.length },
              { label: 'Projects', value: projects.length },
              { label: 'Runs', value: runs.length },
              { label: 'Templates', value: panelCatalog.length },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xl font-extrabold text-slate-900 tabular-nums">{stat.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Storage table */}
          <div className="px-5 py-4 border-b border-slate-100">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Local Storage
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {storageRows.map((row, i) => (
                <div
                  key={row.key}
                  className={`flex items-center justify-between px-3 py-2 text-xs ${
                    i < storageRows.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <code className="font-mono text-slate-700 truncate">{row.key}</code>
                  <span className="ml-2 shrink-0 tabular-nums text-slate-500">
                    {row.present ? `${row.bytes.toLocaleString()} B` : '— empty'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payload preview */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Diagnostic Payload
              </h4>
              <span className="text-[10px] text-slate-400">{APP_VERSION}</span>
            </div>
            <pre className="bg-slate-900 text-slate-200 text-[11px] leading-relaxed p-3 rounded-lg overflow-auto max-h-64">
              {debugPayload}
            </pre>
          </div>
        </div>

        <footer className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearLocalData}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700"
          >
            Clear local data
          </button>
          <div className="flex items-center gap-2">
            {copied && (
              <span className="text-xs font-semibold text-emerald-600">Copied ✓</span>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Copy diagnostics
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ============================================================
// Feature Requests modal — collect ideas locally for now
// ============================================================

const FEEDBACK_STORAGE_KEY = 'taskpanels.featureRequests.v1';

interface FeatureRequest {
  id: string;
  title: string;
  details: string;
  category: 'idea' | 'bug' | 'improvement';
  submittedAt: number;
}

const loadFeatureRequests = (): FeatureRequest[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeatureRequest[]) : [];
  } catch {
    return [];
  }
};

const saveFeatureRequests = (list: FeatureRequest[]): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
};

const FeatureRequestModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [list, setList] = useState<FeatureRequest[]>(() => loadFeatureRequests());
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [category, setCategory] = useState<FeatureRequest['category']>('idea');
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = title.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const entry: FeatureRequest = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `fr_${Date.now()}`,
      title: title.trim(),
      details: details.trim(),
      category,
      submittedAt: Date.now(),
    };
    const next = [entry, ...list];
    setList(next);
    saveFeatureRequests(next);
    setTitle('');
    setDetails('');
    setCategory('idea');
    setSubmitted(true);
    window.setTimeout(() => setSubmitted(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl md:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Feature Requests</h3>
            <p className="text-xs text-slate-500">
              Tell us what would make TaskPanels better. We read every one.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>

        <div className="overflow-auto flex-1">
          <div className="px-5 py-4 space-y-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                Type
              </span>
              <div className="flex flex-wrap gap-2">
                {(['idea', 'improvement', 'bug'] as FeatureRequest['category'][]).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                      category === c
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {c === 'idea' ? 'New idea' : c === 'improvement' ? 'Improvement' : 'Bug report'}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Title
              </span>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="One-line summary"
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Details
                <span className="ml-1 text-slate-400 normal-case font-normal">(optional)</span>
              </span>
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={4}
                placeholder="What problem are you trying to solve? Steps to reproduce, screenshots, anything you'd like us to know."
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
              />
            </label>

            {list.length > 0 && (
              <div className="pt-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Recently sent
                </h4>
                <ul className="space-y-2">
                  {list.slice(0, 5).map(req => (
                    <li
                      key={req.id}
                      className="border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            req.category === 'bug'
                              ? 'bg-rose-50 text-rose-700'
                              : req.category === 'improvement'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {req.category}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {req.title}
                        </span>
                      </div>
                      {req.details && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{req.details}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <footer className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          {submitted && (
            <span className="text-xs font-semibold text-emerald-600">Thanks — sent ✓</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send Request
          </button>
        </footer>
      </div>
    </div>
  );
};

// ============================================================
// Projects management page
// ============================================================

interface ProjectFormState {
  /** id of the project being edited, or 'new' for the create form. */
  mode: 'new' | string;
  name: string;
  colorId: string;
  client: string;
  description: string;
}

const blankForm = (): ProjectFormState => ({
  mode: 'new',
  name: '',
  colorId: 'blue',
  client: '',
  description: '',
});

const editForm = (p: Project): ProjectFormState => ({
  mode: p.id,
  name: p.name,
  colorId: p.colorId,
  client: p.client ?? '',
  description: p.description ?? '',
});

const SettingsProjects: React.FC = () => {
  const {
    projects,
    createProject,
    updateProject,
    archiveProject,
    unarchiveProject,
    deleteProject,
  } = useNav();

  const [form, setForm] = useState<ProjectFormState | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visibleProjects = useMemo(() => {
    return projects
      .filter(p => (showArchived ? p.archived : !p.archived))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, showArchived]);

  const archivedCount = useMemo(
    () => projects.filter(p => p.archived).length,
    [projects],
  );

  const isFormValid = !!form && form.name.trim().length > 0;

  const submitForm = () => {
    if (!form || !isFormValid) return;
    if (form.mode === 'new') {
      createProject({
        name: form.name.trim(),
        colorId: form.colorId,
        client: form.client.trim() || undefined,
        description: form.description.trim() || undefined,
      });
    } else {
      updateProject(form.mode, {
        name: form.name.trim(),
        colorId: form.colorId,
        client: form.client.trim() || undefined,
        description: form.description.trim() || undefined,
      });
    }
    setForm(null);
  };

  const action = (
    <button
      type="button"
      onClick={() => setForm(blankForm())}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-2 rounded-lg"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      New Project
    </button>
  );

  return (
    <SettingsShell
      title="Projects"
      crumb={{ label: 'Workspace', screen: 'settings' }}
      action={action}
    >
      <p className="text-sm text-slate-500 mb-6">
        Projects are first-class. Assign them in any panel, then break down
        time, outcomes, and blockers by project in your reports.
      </p>

      {/* Toggle: active vs archived */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowArchived(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            !showArchived
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          Active ({projects.length - archivedCount})
        </button>
        <button
          type="button"
          onClick={() => setShowArchived(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            showArchived
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          Archived ({archivedCount})
        </button>
      </div>

      {/* List */}
      {visibleProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">
            {showArchived ? 'No archived projects.' : 'No projects yet — create one to get started.'}
          </p>
        </div>
      ) : (
        <ul className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {visibleProjects.map(p => {
            const color = colorOptionFor(p.colorId);
            return (
              <li
                key={p.id}
                className="border-b border-slate-100 last:border-b-0 px-5 py-4 flex items-center gap-3"
              >
                <span
                  className={`w-3 h-3 rounded-full ${color.barClass} shrink-0`}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                  {(p.client || p.description) && (
                    <p className="text-xs text-slate-500 truncate">
                      {[p.client, p.description].filter(Boolean).join(' — ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!p.archived ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setForm(editForm(p))}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveProject(p.id)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100"
                      >
                        Archive
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => unarchiveProject(p.id)}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-50"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete "${p.name}" permanently?`)) {
                            deleteProject(p.id);
                          }
                        }}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-md hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Form modal (inline) */}
      {form && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={() => setForm(null)}
        >
          <div
            className="bg-white w-full max-w-md md:rounded-2xl rounded-t-2xl shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {form.mode === 'new' ? 'New Project' : 'Edit Project'}
              </h3>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </header>
            <div className="px-5 py-5 space-y-4">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Name
                </span>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Website Refresh"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Client / Context
                  <span className="ml-1 text-slate-400 normal-case font-normal">(optional)</span>
                </span>
                <input
                  type="text"
                  value={form.client}
                  onChange={e => setForm({ ...form, client: e.target.value })}
                  placeholder="e.g. Acme Corp"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Description
                  <span className="ml-1 text-slate-400 normal-case font-normal">(optional)</span>
                </span>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="What this project is about"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
                />
              </label>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                  Color
                </span>
                <div className="flex flex-wrap gap-2">
                  {PANEL_COLOR_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm({ ...form, colorId: opt.id })}
                      className={`w-8 h-8 rounded-lg ${opt.barClass} ring-offset-2 ring-offset-white ${
                        form.colorId === opt.id ? 'ring-2 ring-slate-900' : ''
                      }`}
                      aria-label={opt.label}
                    />
                  ))}
                </div>
              </div>
            </div>
            <footer className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitForm}
                disabled={!isFormValid}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {form.mode === 'new' ? 'Create Project' : 'Save Changes'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </SettingsShell>
  );
};

// ============================================================
// Stub sub-pages (Panels, Advanced Labels)
// ============================================================

const SettingsPanels: React.FC = () => {
  const { panelCatalog } = useNav();
  return (
    <SettingsShell title="Panels" crumb={{ label: 'Workspace', screen: 'settings' }}>
      <p className="text-sm text-slate-500 mb-6">
        Manage the panel templates the user picks from. Live panel instances on Home
        keep working even if the source template is renamed or removed.
      </p>
      <ul className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {panelCatalog.map(p => (
          <li
            key={p.id}
            className="border-b border-slate-100 last:border-b-0 px-5 py-4 flex items-center gap-3"
          >
            <span className={`w-3 h-3 rounded-full ${p.barClass} shrink-0`} aria-hidden />
            <span className="text-sm font-semibold text-slate-900 flex-1 truncate">{p.name}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Coming soon
            </span>
          </li>
        ))}
      </ul>
    </SettingsShell>
  );
};

const ADVANCED_LABEL_GROUPS = [
  { id: 'value',     label: 'Value Categories',  description: 'Tag work by business outcome.' },
  { id: 'output',    label: 'Output Types',      description: 'Distinguish drafts, reviews, ships.' },
  { id: 'work',      label: 'Work Styles',       description: 'Deep work vs. shallow vs. collab.' },
  { id: 'session',   label: 'Session Statuses',  description: 'Pickup, blocked, in-progress, etc.' },
];

const SettingsAdvancedLabels: React.FC = () => (
  <SettingsShell title="Advanced Labels" crumb={{ label: 'Workspace', screen: 'settings' }}>
    <p className="text-sm text-slate-500 mb-6">
      Optional metadata for power users. These won't get in the way of normal use,
      but show up in advanced reporting when you want them.
    </p>
    <ul className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {ADVANCED_LABEL_GROUPS.map(g => (
        <li
          key={g.id}
          className="border-b border-slate-100 last:border-b-0 px-5 py-4 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{g.label}</p>
            <p className="text-xs text-slate-500">{g.description}</p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
            Coming soon
          </span>
        </li>
      ))}
    </ul>
  </SettingsShell>
);

// ============================================================
// Notifications — all notification toggles in one screen
// ------------------------------------------------------------
// Master toggle gates everything: if "Enable Notifications" is
// off, none of the sub-features fire. Toggling it on calls
// Notification.requestPermission() and persists the result.
// ============================================================

const SettingsNotifications: React.FC = () => {
  const { preferences, setPreference } = useNav();
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  const handleMasterToggle = async () => {
    if (preferences.notificationsEnabled) {
      // Turning OFF — just flip the preference.
      setPreference('notificationsEnabled', false);
      return;
    }
    // Turning ON — request permission first.
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      setPreference('notificationsEnabled', true);
      setPermissionState('granted');
      return;
    }
    if (Notification.permission === 'denied') {
      setPermissionState('denied');
      return;
    }
    const result = await Notification.requestPermission();
    setPermissionState(result);
    if (result === 'granted') {
      setPreference('notificationsEnabled', true);
    }
  };

  const enabled = preferences.notificationsEnabled && permissionState === 'granted';

  return (
    <SettingsShell title="Notifications" crumb={{ label: 'Settings', screen: 'settings' }}>
      <p className="text-sm text-slate-500 mb-6">
        When and how TaskPanels nudges you throughout the day.
      </p>

      {/* ===== Master Toggle ===== */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Enable Notifications</p>
              <p className="text-xs text-slate-500">
                {permissionState === 'denied'
                  ? 'Blocked by your browser — open browser settings to allow.'
                  : preferences.notificationsEnabled
                    ? 'Notifications are active.'
                    : 'Tap to enable browser notifications.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMasterToggle}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              enabled ? 'bg-blue-500' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={enabled}
            aria-label="Enable notifications"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {permissionState === 'denied' && (
          <div className="px-5 pb-4 -mt-1">
            <p className="text-[11px] text-rose-500">
              Notifications are blocked at the browser level. Go to your browser or
              device settings → TaskPanels → allow notifications, then come back and toggle this on.
            </p>
          </div>
        )}
      </section>

      {/* ===== Sub-features (gated by master toggle) ===== */}
      <div className={`mt-4 space-y-4 transition-opacity ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {/* Daily Reminder */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Daily Reminder</p>
                <p className="text-xs text-slate-500">Nudge to start tracking if nothing is running.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreference('dailyReminderEnabled', !preferences.dailyReminderEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                preferences.dailyReminderEnabled ? 'bg-blue-500' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={preferences.dailyReminderEnabled}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                preferences.dailyReminderEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
          {preferences.dailyReminderEnabled && (
            <div className="px-5 pb-4 -mt-1 flex items-center gap-3">
              <span className="text-xs text-slate-500">Remind at</span>
              <input
                type="time"
                value={preferences.dailyReminderTime}
                onChange={e => setPreference('dailyReminderTime', e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          )}
        </section>

        {/* End-of-Day Prompt */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">End-of-Day Prompt</p>
                <p className="text-xs text-slate-500">Reminder to generate your daily summary.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreference('endOfDayEnabled', !preferences.endOfDayEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                preferences.endOfDayEnabled ? 'bg-blue-500' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={preferences.endOfDayEnabled}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                preferences.endOfDayEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
          {preferences.endOfDayEnabled && (
            <div className="px-5 pb-4 -mt-1 flex items-center gap-3">
              <span className="text-xs text-slate-500">Prompt at</span>
              <input
                type="time"
                value={preferences.endOfDayTime}
                onChange={e => setPreference('endOfDayTime', e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          )}
        </section>

        {/* Idle Warning */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Idle Warning</p>
                <p className="text-xs text-slate-500">Alert when the same panel has been running too long.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreference('idleWarningEnabled', !preferences.idleWarningEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                preferences.idleWarningEnabled ? 'bg-blue-500' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={preferences.idleWarningEnabled}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                preferences.idleWarningEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
          {preferences.idleWarningEnabled && (
            <div className="px-5 pb-4 -mt-1 flex items-center gap-3">
              <span className="text-xs text-slate-500">Warn after</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={480}
                value={preferences.idleWarningMinutes}
                onChange={e => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n) && n >= 1) {
                    setPreference('idleWarningMinutes', Math.min(480, n));
                  }
                }}
                className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
              <span className="text-xs text-slate-500">minutes</span>
            </div>
          )}
        </section>
      </div>
    </SettingsShell>
  );
};

// ============================================================
// Appearance — Preferences sub-screen
// ============================================================

const SettingsAppearance: React.FC = () => {
  const { preferences, setPreference } = useNav();
  return (
    <SettingsShell title="Appearance" crumb={{ label: 'Preferences', screen: 'settings' }}>
      <p className="text-sm text-slate-500 mb-6">
        Visual settings that affect how times and data are displayed throughout the app.
      </p>

      {/* Time Format */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Time Format</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            How clock times are shown — session start/end, timeline entries, etc.
          </p>
        </header>
        <div className="px-5 py-4 flex gap-3">
          {([
            { id: '12h' as const, label: '12-hour', example: '2:30 PM' },
            { id: '24h' as const, label: '24-hour', example: '14:30' },
          ]).map(opt => {
            const selected = preferences.timeFormat === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPreference('timeFormat', opt.id)}
                className={`flex-1 px-4 py-3 rounded-xl border text-left transition-colors ${
                  selected
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-slate-700'}`}>
                  {opt.label}
                </p>
                <p className={`text-xs mt-0.5 tabular-nums ${selected ? 'text-blue-500' : 'text-slate-400'}`}>
                  {opt.example}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Dark Mode — placeholder */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Dark Mode</p>
            <p className="text-xs text-slate-500 mt-0.5">
              A full dark theme for low-light environments.
            </p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 ml-3">
            Coming soon
          </span>
        </div>
      </section>
    </SettingsShell>
  );
};

// ============================================================
// Default Day View — Preferences sub-screen
// ============================================================

const SettingsDefaultView: React.FC = () => {
  const { preferences, setPreference } = useNav();
  return (
    <SettingsShell title="Default Day View" crumb={{ label: 'Preferences', screen: 'settings' }}>
      <p className="text-sm text-slate-500 mb-6">
        Which tab the Home screen opens to when you launch the app or navigate back from another screen.
      </p>
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {([
          {
            id: 'today' as const,
            label: 'Today',
            description: 'Your active panels and running timer.',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            ),
          },
          {
            id: 'week' as const,
            label: 'This Week',
            description: 'Weekly summary of your tracked sessions.',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            ),
            soon: true,
          },
          {
            id: 'archive' as const,
            label: 'Archive',
            description: 'Historical reports and saved summaries.',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            ),
            soon: true,
          },
        ]).map((opt, i, arr) => {
          const selected = preferences.defaultHomeTab === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPreference('defaultHomeTab', opt.id)}
              className={`w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 ${
                i < arr.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                selected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-slate-900'}`}>
                  {opt.label}
                  {opt.soon && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      View coming soon
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{opt.description}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                selected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-white'
              }`}>
                {selected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </section>
      <p className="mt-4 text-[11px] text-slate-400">
        "This Week" and "Archive" views are being built — selecting them stores your preference
        so the tab switches automatically once the views ship.
      </p>
    </SettingsShell>
  );
};

// ============================================================
// Break & Lunch Defaults — Preferences sub-screen
// ------------------------------------------------------------
// Lets the user pick the default countdown length for Break and
// Lunch. Durations are stored as milliseconds in NavContext but
// the UI operates in whole minutes — feels much better to type
// "20" than "1200000". We store on every change (no Save button)
// so the next tap of Break / Lunch on Home uses the new default
// immediately; existing running countdowns are NOT retroactively
// shortened (that lives in startBreak's closure at start time).
// ============================================================

// Hard bounds match the clamp in lib/breakDefaults.ts. Duplicated
// here so the input's min/max attributes give immediate feedback
// on the up/down arrows without needing a JS round trip.
const BREAK_MIN_MINUTES = 1;
const BREAK_MAX_MINUTES = 8 * 60; // 8 hours — a full workday

interface BreakRowProps {
  label: string;
  description: string;
  minutes: number;
  accentClass: string;
  onChange: (minutes: number) => void;
}

const BreakRow: React.FC<BreakRowProps> = ({
  label,
  description,
  minutes,
  accentClass,
  onChange,
}) => {
  // Local string state lets the user clear the field mid-edit
  // without bouncing back to "1" on every keystroke. We only
  // commit the parsed value when it's a valid number.
  const [draft, setDraft] = useState<string>(String(minutes));
  // Keep local draft in sync if the upstream value changes (e.g.
  // another device syncs, or the clamp snapped a too-big value).
  useEffect(() => {
    setDraft(String(minutes));
  }, [minutes]);

  const commit = (value: string) => {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) {
      const clamped = Math.max(BREAK_MIN_MINUTES, Math.min(BREAK_MAX_MINUTES, n));
      onChange(clamped);
      setDraft(String(clamped));
    } else {
      // Empty / invalid on blur → snap back to the committed value.
      setDraft(String(minutes));
    }
  };

  return (
    <div className="px-5 py-4 flex items-center gap-4 border-b border-slate-100 last:border-b-0">
      <div className={`w-10 h-10 rounded-xl ${accentClass} flex items-center justify-center shrink-0`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          inputMode="numeric"
          min={BREAK_MIN_MINUTES}
          max={BREAK_MAX_MINUTES}
          step={1}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          aria-label={`${label} duration in minutes`}
        />
        <span className="text-xs font-medium text-slate-500">min</span>
      </div>
    </div>
  );
};

const SettingsBreakDefaults: React.FC = () => {
  const { breakDurationsMs, setBreakDurationMs } = useNav();
  const breakMin = Math.round(breakDurationsMs.break / 60000);
  const lunchMin = Math.round(breakDurationsMs.lunch / 60000);

  return (
    <SettingsShell title="Break & Lunch Defaults" crumb={{ label: 'Preferences', screen: 'settings' }}>
      <p className="text-sm text-slate-500 mb-6">
        How long the Break and Lunch countdowns run when you tap them on Home.
        Changing a value saves immediately — the next time you tap Break or Lunch,
        the new countdown starts.
      </p>
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <BreakRow
          label="Break"
          description="Short pause — stretch, refill coffee, clear your head."
          minutes={breakMin}
          accentClass="bg-amber-100 text-amber-700"
          onChange={min => setBreakDurationMs('break', min * 60 * 1000)}
        />
        <BreakRow
          label="Lunch"
          description="Longer mid-day break — the full meal."
          minutes={lunchMin}
          accentClass="bg-rose-100 text-rose-700"
          onChange={min => setBreakDurationMs('lunch', min * 60 * 1000)}
        />
      </section>
      <p className="mt-4 text-[11px] text-slate-400">
        Range: {BREAK_MIN_MINUTES}–{BREAK_MAX_MINUTES} minutes. Values outside this range are clamped.
      </p>
    </SettingsShell>
  );
};

// ============================================================
// Settings: Summary Defaults
// ============================================================

const AUDIENCE_OPTIONS: { value: AppPreferences['defaultAudience']; label: string; description: string }[] = [
  { value: 'manager',  label: 'Manager',  description: 'Formal tone, outcome-focused' },
  { value: 'team',     label: 'Team',     description: 'Collaborative, progress updates' },
  { value: 'client',   label: 'Client',   description: 'External-facing, billable focus' },
  { value: 'personal', label: 'Personal', description: 'Reflective, for your own records' },
];

const STYLE_OPTIONS: { value: AppPreferences['defaultSummaryStyle']; label: string; description: string }[] = [
  { value: 'concise',  label: 'Concise',  description: 'Headlines only — fast to scan' },
  { value: 'standard', label: 'Standard', description: 'Balanced detail and brevity' },
  { value: 'detailed', label: 'Detailed', description: 'Full narrative with breakdowns' },
];

const SettingsSummaryDefaults: React.FC = () => {
  const { preferences, setPreference } = useNav();
  return (
    <SettingsShell title="Summary Defaults" crumb={{ label: 'Reporting', screen: 'settings' }}>
      <p className="text-sm text-slate-500 mb-6">
        These defaults pre-fill when you open Prepare Summary. You can always change
        them per-report — this just sets the starting point.
      </p>

      {/* Default Audience */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Default Audience</h3>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {AUDIENCE_OPTIONS.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPreference('defaultAudience', opt.value)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                i > 0 ? 'border-t border-slate-100' : ''
              } ${preferences.defaultAudience === opt.value ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                preferences.defaultAudience === opt.value
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-slate-300'
              }`}>
                {preferences.defaultAudience === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Default Summary Style */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Default Detail Level</h3>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {STYLE_OPTIONS.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPreference('defaultSummaryStyle', opt.value)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                i > 0 ? 'border-t border-slate-100' : ''
              } ${preferences.defaultSummaryStyle === opt.value ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                preferences.defaultSummaryStyle === opt.value
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-slate-300'
              }`}>
                {preferences.defaultSummaryStyle === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Overtime Threshold */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Overtime Threshold</h3>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900">Flag overtime after</div>
              <div className="text-xs text-slate-500">
                Tracked time beyond this is highlighted in your summary
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreference('overtimeThresholdHours', Math.max(1, preferences.overtimeThresholdHours - 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300"
              >
                <span className="text-lg leading-none">−</span>
              </button>
              <span className="text-sm font-semibold text-slate-900 w-12 text-center tabular-nums">
                {preferences.overtimeThresholdHours}h
              </span>
              <button
                type="button"
                onClick={() => setPreference('overtimeThresholdHours', Math.min(16, preferences.overtimeThresholdHours + 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300"
              >
                <span className="text-lg leading-none">+</span>
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Range: 1–16 hours.
        </p>
      </section>
    </SettingsShell>
  );
};

// ============================================================
// Settings: Email Template
// ============================================================

const SettingsEmailTemplate: React.FC = () => {
  const { preferences, setPreference } = useNav();
  const [subject, setSubject] = useState(preferences.emailSubjectTemplate);

  // Debounce save — commit to preferences when user stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      if (subject.trim() && subject !== preferences.emailSubjectTemplate) {
        setPreference('emailSubjectTemplate', subject);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [subject, preferences.emailSubjectTemplate, setPreference]);

  const toggleRow = (
    label: string,
    description: string,
    prefKey: 'emailIncludeTimeline' | 'emailIncludeNarrative' | 'emailIncludeProjects',
  ) => (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={preferences[prefKey]}
        onClick={() => setPreference(prefKey, !preferences[prefKey])}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          preferences[prefKey] ? 'bg-blue-500' : 'bg-slate-200'
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          preferences[prefKey] ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  );

  return (
    <SettingsShell title="Email Template" crumb={{ label: 'Reporting', screen: 'settings' }}>
      <p className="text-sm text-slate-500 mb-6">
        Customize what goes into your summary emails. The template applies to both
        manual exports and auto daily emails.
      </p>

      {/* Subject line */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Subject Line</h3>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Daily Summary — {date}"
            className="w-full text-sm text-slate-900 bg-transparent border-0 outline-none placeholder-slate-300"
          />
          <p className="mt-2 text-[11px] text-slate-400">
            Use <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">{'{date}'}</code> as
            a placeholder for the report date.
          </p>
        </div>
      </section>

      {/* Include blocks */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Include in Export</h3>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {toggleRow('Timeline', 'Time-of-day rail showing when you worked on what', 'emailIncludeTimeline')}
          {toggleRow('Narrative', 'The written summary paragraph(s)', 'emailIncludeNarrative')}
          {toggleRow('Project Breakdown', 'Per-project time and outcome rollups', 'emailIncludeProjects')}
        </div>
      </section>

      {/* Preview badge */}
      <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 text-center">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Preview</div>
        <div className="text-sm text-slate-600 font-medium">
          {subject.replace('{date}', new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          {preferences.emailIncludeTimeline && <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200">Timeline</span>}
          {preferences.emailIncludeNarrative && <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200">Narrative</span>}
          {preferences.emailIncludeProjects && <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200">Projects</span>}
        </div>
      </div>
    </SettingsShell>
  );
};

// ============================================================
// Settings: Auto Daily Email
// ============================================================

const SettingsAutoEmail: React.FC = () => {
  const { preferences, setPreference } = useNav();

  /** Convert "HH:MM" ↔ time input. */
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (/^\d{2}:\d{2}$/.test(v)) {
      setPreference('autoDailyEmailTime', v);
    }
  };

  /** Convert 24h "HH:MM" to display string respecting user's time format pref. */
  const displayTime = (hhmm: string) => {
    const [hStr, mStr] = hhmm.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr;
    if (preferences.timeFormat === '24h') return hhmm;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <SettingsShell title="Auto Daily Email" crumb={{ label: 'Reporting', screen: 'settings' }}>
      <p className="text-sm text-slate-500 mb-6">
        Automatically email your daily summary at a set time each day.
        The email uses your Email Template settings for formatting.
      </p>

      {/* Master toggle */}
      <section className="mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900">Enable Auto Daily Email</div>
              <div className="text-xs text-slate-500">
                Send your summary automatically — no manual export needed
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.autoDailyEmailEnabled}
              onClick={() => setPreference('autoDailyEmailEnabled', !preferences.autoDailyEmailEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                preferences.autoDailyEmailEnabled ? 'bg-blue-500' : 'bg-slate-200'
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                preferences.autoDailyEmailEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </section>

      {/* Sub-settings — only interactive when enabled */}
      <div className={preferences.autoDailyEmailEnabled ? '' : 'opacity-50 pointer-events-none'}>
        {/* Send time */}
        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Send Time</h3>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">Daily at</div>
                <div className="text-xs text-slate-500">
                  Currently set to {displayTime(preferences.autoDailyEmailTime)}
                </div>
              </div>
              <input
                type="time"
                value={preferences.autoDailyEmailTime}
                onChange={handleTimeChange}
                className="text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
              />
            </div>
          </div>
        </section>

        {/* Recipient */}
        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Recipient</h3>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <input
              type="email"
              value={preferences.autoDailyEmailRecipient}
              onChange={e => setPreference('autoDailyEmailRecipient', e.target.value)}
              placeholder="manager@company.com"
              className="w-full text-sm text-slate-900 bg-transparent border-0 outline-none placeholder-slate-300"
            />
            <p className="mt-2 text-[11px] text-slate-400">
              The email address that receives your automatic daily summary.
            </p>
          </div>
        </section>

        {/* Status badge */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <div className="text-sm font-medium text-amber-800">Email delivery coming soon</div>
            <div className="text-xs text-amber-600 mt-0.5">
              Your settings are saved and will take effect once email integration is live.
              For now, use the export button on the Daily Summary screen.
            </div>
          </div>
        </div>
      </div>
    </SettingsShell>
  );
};

// ============================================================
// Router
// ============================================================

export const SettingsScreen: React.FC = () => {
  const { screen } = useNav();
  // Keep activeProjects import alive for type-check parity even though we
  // sort locally above. (Helps tree-shaking visibility.)
  void activeProjects;
  switch (screen) {
    case 'settings-projects':
      return <SettingsProjects />;
    case 'settings-panels':
      return <SettingsPanels />;
    case 'settings-advanced-labels':
      return <SettingsAdvancedLabels />;
    case 'settings-breaks':
      return <SettingsBreakDefaults />;
    case 'settings-appearance':
      return <SettingsAppearance />;
    case 'settings-day-view':
      return <SettingsDefaultView />;
    case 'settings-notifications':
      return <SettingsNotifications />;
    case 'settings-summary-defaults':
      return <SettingsSummaryDefaults />;
    case 'settings-email-template':
      return <SettingsEmailTemplate />;
    case 'settings-auto-email':
      return <SettingsAutoEmail />;
    case 'settings':
    default:
      return <SettingsHome />;
  }
};

// ============================================================
// V6 Desktop Sidebar — slim icon nav (w-16)
// Matches taskpanels.app/concepts/v6-panel-cards.html
// ============================================================

import React from 'react';
import type { AppState } from '../../types';

interface Props {
  view: AppState['view'];
  role?: string;
  onNavigate: (view: AppState['view']) => void;
}

const navItems: { view: AppState['view']; label: string; icon: React.ReactNode; roles?: string[] }[] = [
  {
    view: 'dashboard',
    label: 'Tracker',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    view: 'summary',
    label: 'Summary',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    view: 'manager',
    label: 'Team',
    roles: ['manager', 'admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    view: 'history',
    label: 'Backdate',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export const Sidebar: React.FC<Props> = ({ view, role, onNavigate }) => {
  const visibleItems = navItems.filter(
    item => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <nav className="hidden md:flex w-16 bg-white border-r border-slate-100 flex-col items-center py-4 shrink-0">
      {/* Logo */}
      <div className="mb-6">
        <svg width="28" height="28" viewBox="0 0 32 32">
          <circle cx="10" cy="10" r="5" fill="#3b82f6" />
          <circle cx="22" cy="10" r="5" fill="#f97316" />
          <circle cx="10" cy="22" r="5" fill="#8b5cf6" />
          <circle cx="22" cy="22" r="5" fill="#10b981" />
        </svg>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-2 flex-1">
        {visibleItems.map(item => (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150
              ${view === item.view
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-400 hover:bg-slate-50'
              }`}
            title={item.label}
            aria-label={item.label}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* Settings at bottom */}
      <button
        onClick={() => onNavigate('settings')}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150
          ${view === 'settings'
            ? 'bg-blue-50 text-blue-600'
            : 'text-slate-400 hover:bg-slate-50'
          }`}
        title="Settings"
        aria-label="Settings"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </nav>
  );
};

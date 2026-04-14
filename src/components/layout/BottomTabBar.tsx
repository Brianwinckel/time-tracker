// ============================================================
// V6 Mobile Bottom Tab Bar
// Matches taskpanels.app/concepts/v6-panel-cards.html
// ============================================================

import React from 'react';
import type { AppState } from '../../types';

interface Props {
  view: AppState['view'];
  onNavigate: (view: AppState['view']) => void;
}

const tabs: { view: AppState['view']; label: string; icon: React.ReactNode }[] = [
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
    view: 'prepare-summary',
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
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    view: 'settings',
    label: 'More',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
];

export const BottomTabBar: React.FC<Props> = ({ view, onNavigate }) => {
  return (
    <nav className="md:hidden bg-white border-t border-slate-100 px-2 pb-6 pt-2 flex items-center justify-around shrink-0">
      {tabs.map(tab => (
        <button
          key={tab.view}
          onClick={() => onNavigate(tab.view)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors duration-150
            ${view === tab.view ? 'text-blue-500' : 'text-slate-400'}`}
          aria-label={tab.label}
        >
          {tab.icon}
          <span className={`text-[10px] ${view === tab.view ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

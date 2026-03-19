// ============================================================
// App header — navigation and date display
// ============================================================

import React from 'react';
import { useApp } from '../context/AppContext';
import { formatDateLong } from '../utils/time';
import type { AppState } from '../types';

export const Header: React.FC = () => {
  const { state, dispatch } = useApp();

  const navItems: { view: AppState['view']; label: string }[] = [
    { view: 'dashboard', label: 'Tracker' },
    { view: 'summary', label: 'Summary' },
    { view: 'history', label: 'Backdate' },
    { view: 'settings', label: 'Settings' },
  ];

  return (
    <header className="header">
      <div className="header__left">
        <h1 className="header__title">TimeTracker</h1>
        <span className="header__date">{formatDateLong(state.currentDate)}</span>
      </div>

      <nav className="header__nav">
        {navItems.map(item => (
          <button
            key={item.view}
            className={`header__nav-btn ${state.view === item.view ? 'header__nav-btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_VIEW', view: item.view })}
          >
            {item.label}
          </button>
        ))}

        <button
          className="header__dark-toggle"
          onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { darkMode: !state.settings.darkMode } })}
          title="Toggle dark mode (D)"
        >
          {state.settings.darkMode ? '☀' : '☾'}
        </button>
      </nav>
    </header>
  );
};

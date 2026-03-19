// ============================================================
// App header — navigation, date, user info, sign out
// ============================================================

import React from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDateLong } from '../utils/time';
import type { AppState } from '../types';

export const Header: React.FC = () => {
  const { state, dispatch } = useApp();
  const { profile, signOut } = useAuth();

  const isManagerOrAdmin = profile?.role === 'manager' || profile?.role === 'admin';

  const navItems: { view: AppState['view']; label: string; show: boolean }[] = [
    { view: 'dashboard', label: 'Tracker', show: true },
    { view: 'summary', label: 'Summary', show: true },
    { view: 'manager', label: 'Team', show: isManagerOrAdmin },
    { view: 'history', label: 'Backdate', show: true },
    { view: 'settings', label: 'Settings', show: true },
  ];

  return (
    <header className="header">
      <div className="header__left">
        <h1 className="header__title">TimeTracker</h1>
        <span className="header__date">{formatDateLong(state.currentDate)}</span>
      </div>

      <nav className="header__nav">
        {navItems.filter(item => item.show).map(item => (
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

        {profile && (
          <div className="header__user">
            <span className="header__user-name">{profile.name || profile.email}</span>
            <button className="header__signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </nav>
    </header>
  );
};

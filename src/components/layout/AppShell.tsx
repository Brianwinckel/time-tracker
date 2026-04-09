// ============================================================
// V6 App Shell — responsive layout wrapper
// Desktop: sidebar + content
// Mobile: top header + content + bottom tab bar
// ============================================================

import React from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { MobileHeader } from './MobileHeader';
import type { AppState } from '../../types';

// View titles for the mobile header
const viewTitles: Record<AppState['view'], string> = {
  dashboard: 'TaskPanels',
  summary: 'Daily Summary',
  settings: 'Settings',
  history: 'Backdate',
  manager: 'Team Dashboard',
  admin: 'Admin',
};

interface Props {
  children: React.ReactNode;
}

export const AppShell: React.FC<Props> = ({ children }) => {
  const { state, dispatch } = useApp();
  const { profile } = useAuth();

  const navigate = (view: AppState['view']) => {
    dispatch({ type: 'SET_VIEW', view });
  };

  const toggleDarkMode = () => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: { darkMode: !state.settings.darkMode } });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Desktop sidebar */}
      <Sidebar
        view={state.view}
        role={profile?.role}
        onNavigate={navigate}
      />

      {/* Main content column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <MobileHeader
          title={viewTitles[state.view]}
          userName={state.settings.myName || profile?.name}
          darkMode={state.settings.darkMode}
          onToggleDarkMode={toggleDarkMode}
          onAvatarClick={() => navigate('settings')}
        />

        {/* Scrollable content area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <BottomTabBar view={state.view} onNavigate={navigate} />
      </div>
    </div>
  );
};

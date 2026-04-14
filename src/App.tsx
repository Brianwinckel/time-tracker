// ============================================================
// App — auth gate + the new V6 TaskPanelsApp.
//
// The legacy AppProvider / AppShell / Dashboard / Settings etc.
// are intentionally no longer mounted here. All state and
// routing lives inside <TaskPanelsApp />, backed by localStorage.
// ============================================================

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { TaskPanelsApp } from './components/TaskPanelsApp';
import { TaskPanelsLogo } from './components/TaskPanelsLogo';

// Auth gate — only checks login state. A user doesn't need a team_id
// to use TaskPanels — this is a personal time tracker first.
const AuthGate: React.FC = () => {
  const { user, loading } = useAuth();

  // Still checking auth state — show the breathing brand mark instead
  // of a "Loading..." text blob.
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-white gap-4">
        <TaskPanelsLogo size={72} animated />
        <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
          TaskPanels
        </span>
      </div>
    );
  }

  // Not logged in — show login screen
  if (!user) {
    return <AuthScreen />;
  }

  // Fully authenticated — show the app
  return <TaskPanelsApp />;
};

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;

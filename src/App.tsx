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

// Auth gate — only checks login state. A user doesn't need a team_id
// to use TaskPanels — this is a personal time tracker first.
const AuthGate: React.FC = () => {
  const { user, loading } = useAuth();

  // Still checking auth state
  if (loading) {
    return <div className="loading-screen">Loading...</div>;
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

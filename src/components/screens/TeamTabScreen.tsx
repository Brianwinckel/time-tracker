// ============================================================
// TeamTabScreen — router for the Team tab.
//
// Branches on the caller's auth state:
//   no team_id              → TeamGateScreen (upgrade pitch)
//   team_role = 'member'    → TeamMemberScreen (read-only)
//   team_role ∈ owner|admin → TeamAdminScreen (dashboard)
// ============================================================

import React from 'react';
import { useAuthOptional } from '../../context/AuthContext';
import { TeamGateScreen } from './TeamGateScreen';
import { TeamAdminScreen } from './TeamAdminScreen';
import { TeamMemberScreen } from './TeamMemberScreen';

export const TeamTabScreen: React.FC = () => {
  // useAuthOptional so the preview.tsx harness (no AuthProvider) falls
  // through to the gate instead of throwing.
  const auth = useAuthOptional();

  // Profile may still be hydrating right after sign-in. Render nothing
  // briefly rather than flashing the gate to a newly-joined member.
  if (auth?.loading) return null;

  const profile = auth?.profile;
  if (!profile?.team_id) return <TeamGateScreen />;
  if (profile.team_role === 'owner' || profile.team_role === 'admin') {
    return <TeamAdminScreen />;
  }
  return <TeamMemberScreen />;
};

// ============================================================
// User management table — list users, change roles, assign teams
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../context/AuthContext';

interface Team {
  id: string;
  name: string;
}

export const UserTable: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [usersRes, teamsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('name'),
        supabase.from('teams').select('id, name').order('name'),
      ]);
      setUsers((usersRes.data ?? []) as Profile[]);
      setTeams((teamsRes.data ?? []) as Team[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    setSaving(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    if (error) {
      alert('Failed to update role: ' + error.message);
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as Profile['role'] } : u));
    }
    setSaving(null);
  };

  const handleTeamChange = async (userId: string, teamId: string) => {
    setSaving(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: teamId || null })
      .eq('id', userId);
    if (error) {
      alert('Failed to update team: ' + error.message);
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, team_id: teamId || null } : u));
    }
    setSaving(null);
  };

  if (loading) return <p>Loading users...</p>;

  return (
    <div className="user-table">
      <h3>All Users ({users.length})</h3>

      <div className="user-table__grid">
        <div className="user-table__header">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Team</span>
        </div>

        {users.map(user => (
          <div key={user.id} className={`user-table__row ${saving === user.id ? 'user-table__row--saving' : ''}`}>
            <span className="user-table__name">{user.name || '—'}</span>
            <span className="user-table__email">{user.email}</span>
            <select
              className="user-table__select"
              value={user.role}
              onChange={e => handleRoleChange(user.id, e.target.value)}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="user-table__select"
              value={user.team_id ?? ''}
              onChange={e => handleTeamChange(user.id, e.target.value)}
            >
              <option value="">No team</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        ))}

        {users.length === 0 && (
          <p className="user-table__empty">No users yet. Invite someone to get started.</p>
        )}
      </div>
    </div>
  );
};

// ============================================================
// First-login team selector — shown when profile.team_id is null
// Copies team_tasks into the user's personal tasks table
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Team {
  id: string;
  name: string;
}

export const TeamSelector: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch available teams
  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      if (data) setTeams(data);
      setLoading(false);
    };
    fetchTeams();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !user) return;

    setSubmitting(true);

    // 1. Update profile with team and display name
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        team_id: selectedTeam,
        name: displayName.trim() || undefined,
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('Failed to update profile:', profileError.message);
      setSubmitting(false);
      return;
    }

    // 2. Also update the my_name in settings
    if (displayName.trim()) {
      await supabase
        .from('user_settings')
        .update({ my_name: displayName.trim() })
        .eq('user_id', user.id);
    }

    // 3. Copy team_tasks into user's personal tasks
    const { data: teamTasks } = await supabase
      .from('team_tasks')
      .select('name, color, "order"')
      .eq('team_id', selectedTeam)
      .order('"order"');

    if (teamTasks && teamTasks.length > 0) {
      const userTasks = teamTasks.map((tt) => ({
        user_id: user.id,
        name: tt.name,
        color: tt.color,
        is_custom: false,
        is_pinned: true,
        order: tt.order,
      }));

      await supabase.from('tasks').insert(userTasks);
    }

    // 4. Refresh profile to exit this screen
    await refreshProfile();
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p>Loading teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Welcome!</h1>
        <p className="auth-subtitle">Let's get you set up. Pick your team and enter your name.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span>Your Name</span>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your full name"
              autoFocus
            />
          </label>

          <label className="field">
            <span>Your Team</span>
            <select
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              required
            >
              <option value="">Select a team...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={submitting || !selectedTeam}
          >
            {submitting ? 'Setting up...' : 'Join Team & Start Tracking'}
          </button>
        </form>
      </div>
    </div>
  );
};

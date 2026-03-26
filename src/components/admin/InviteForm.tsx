// ============================================================
// Invite form — send magic link invites to new employees
// Uses Supabase's built-in invite (no Edge Function needed for MVP)
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Team {
  id: string;
  name: string;
}

export const InviteForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase.from('teams').select('id, name').order('name');
      setTeams((data ?? []) as Team[]);
    };
    fetchTeams();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setResult(null);

    // Use signInWithOtp to send a magic link invite
    // The user will be created on first click and the profile trigger will fire
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Don't actually sign in the admin — just send the invite link
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setResult({ type: 'error', message: error.message });
    } else {
      setResult({
        type: 'success',
        message: `Magic link sent to ${email}. They'll be prompted to pick a team on first login.${selectedTeam ? ' You can also pre-assign their team in the Users tab.' : ''}`,
      });
      setEmail('');
    }
    setSending(false);
  };

  return (
    <div className="invite-form">
      <h3>Invite New User</h3>
      <p className="invite-form__desc">
        Send a magic link to invite someone to TaskPanels. They'll create their account
        when they click the link and can pick their team on first login.
      </p>

      <form onSubmit={handleInvite} className="invite-form__form">
        <label className="field">
          <span>Email Address</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
          />
        </label>

        <label className="field">
          <span>Suggested Team (optional)</span>
          <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
            <option value="">They'll choose on first login</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <small className="field__hint">
            You can assign their team in the Users tab after they sign up.
          </small>
        </label>

        <button
          type="submit"
          className="btn btn--primary"
          disabled={sending || !email.trim()}
        >
          {sending ? 'Sending...' : 'Send Invite'}
        </button>

        {result && (
          <div className={`invite-form__result invite-form__result--${result.type}`}>
            {result.message}
          </div>
        )}
      </form>
    </div>
  );
};

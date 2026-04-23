// ============================================================
// TeamCheckoutModal
// ------------------------------------------------------------
// Shared "configure your team" modal used by PaywallScreen (new
// signup) and TeamGateScreen (existing individual user clicking
// Upgrade to Team). Collects team name + seat count (min 5),
// calls the stripe-checkout edge function with mode='team', and
// redirects to Stripe Checkout. The webhook handles the actual
// team + billing_customers bootstrap on session completion, so
// abandoning checkout leaves no app-side state.
// ============================================================

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PLANS, TEAM_MIN_SEATS } from '../lib/billing';
import type { BillingInterval } from '../types/billing';

interface Props {
  open: boolean;
  interval: BillingInterval;
  onClose: () => void;
}

export const TeamCheckoutModal: React.FC<Props> = ({ open, interval, onClose }) => {
  const [teamName, setTeamName] = useState('');
  const [seats, setSeats] = useState<number>(TEAM_MIN_SEATS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const team = PLANS.team;
  const monthlyTotal = team.monthlyPrice * seats;
  const yearlyTotal = team.yearlyMonthlyEquivalent * seats * 12;

  const handleSubmit = async () => {
    const name = teamName.trim();
    if (!name) { setError('Team name is required'); return; }
    if (seats < TEAM_MIN_SEATS) { setError(`Minimum ${TEAM_MIN_SEATS} seats`); return; }

    setError(null);
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          plan: 'team',
          mode: 'team',
          interval,
          teamName: name,
          seats,
          appUrl: window.location.origin,
        },
      });
      if (fnError) throw fnError;
      if (!data?.url) throw new Error('No checkout URL returned');
      const url = new URL(data.url);
      if (!url.hostname.endsWith('stripe.com')) {
        throw new Error('Invalid checkout redirect');
      }
      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      console.error('Team checkout error:', err);
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-slate-900">Set up your team</h2>
        <p className="mt-1 text-sm text-slate-500">
          You'll be the owner. Invite your team from the dashboard after checkout.
        </p>

        <label className="mt-6 block text-sm font-medium text-slate-700">
          Team name
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Acme Inc."
            autoFocus
            maxLength={80}
            disabled={submitting}
            className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Seats
          <div className="mt-1.5 flex items-stretch rounded-lg border border-slate-200 bg-slate-50 focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-200">
            <button
              type="button"
              onClick={() => setSeats((s) => Math.max(TEAM_MIN_SEATS, s - 1))}
              disabled={submitting || seats <= TEAM_MIN_SEATS}
              aria-label="Decrease seats"
              className="px-3.5 text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:hover:text-slate-500"
            >
              −
            </button>
            <input
              type="number"
              min={TEAM_MIN_SEATS}
              value={seats}
              disabled={submitting}
              onChange={(e) => {
                const n = parseInt(e.target.value || '0', 10);
                setSeats(Number.isFinite(n) ? Math.max(TEAM_MIN_SEATS, n) : TEAM_MIN_SEATS);
              }}
              className="flex-1 bg-transparent px-2 py-2.5 text-center text-sm font-semibold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setSeats((s) => s + 1)}
              disabled={submitting}
              aria-label="Increase seats"
              className="px-3.5 text-slate-500 hover:text-slate-900 disabled:opacity-40"
            >
              +
            </button>
          </div>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Minimum {TEAM_MIN_SEATS}. You can add more later from the Stripe portal.
          </span>
        </label>

        <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span>
              {seats} seats × ${interval === 'year' ? team.yearlyMonthlyEquivalent : team.monthlyPrice}/mo
            </span>
            <span className="font-semibold text-slate-900">
              ${interval === 'year' ? yearlyTotal : monthlyTotal}
              <span className="text-xs font-normal text-slate-500">
                /{interval === 'year' ? 'yr' : 'mo'}
              </span>
            </span>
          </div>
          {interval === 'year' && (
            <div className="mt-1 text-xs text-slate-400">
              (${monthlyTotal}/mo billed yearly)
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !teamName.trim() || seats < TEAM_MIN_SEATS}
            className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Redirecting…' : 'Continue to checkout'}
          </button>
        </div>
      </div>
    </div>
  );
};

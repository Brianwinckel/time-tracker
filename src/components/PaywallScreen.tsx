// ============================================================
// PaywallScreen
// ------------------------------------------------------------
// Shown to signed-in users who don't have an active subscription.
// Calls the stripe-checkout edge function and redirects to the
// hosted checkout URL.
//
// Team is shown as "Coming Soon" (from PLANS.team.comingSoon),
// clickable only enough to say so — no checkout path yet.
// ============================================================

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { TaskPanelsLogo } from './TaskPanelsLogo';
import { PLANS, formatPrice, periodLabel } from '../lib/billing';
import type { BillingInterval, PlanId } from '../types/billing';

const CheckIcon = () => (
  <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PaywallScreen: React.FC = () => {
  const { signOut, user } = useAuth();
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (plan: PlanId) => {
    if (PLANS[plan].comingSoon) return;
    setError(null);
    setLoading(plan);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: { plan, interval, appUrl: window.location.origin },
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
      console.error('Checkout error:', err);
      setError(message);
      setLoading(null);
    }
  };

  const individual = PLANS.individual;
  const team = PLANS.team;

  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <TaskPanelsLogo wordmark size={32} />
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Intro */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Pick a plan to continue
          </h1>
          <p className="mt-3 text-slate-500">
            {user?.email && <>Signed in as <span className="font-medium text-slate-700">{user.email}</span>. </>}
            Choose a plan to unlock TaskPanels.
          </p>
        </div>

        {/* Monthly / Yearly toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setInterval('month')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                interval === 'month'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval('year')}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                interval === 'year'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Yearly
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Individual — the actual CTA */}
          <div className="relative rounded-2xl border-2 border-blue-500 bg-white p-7 shadow-md">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
                Recommended
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{individual.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-900">
                {formatPrice(individual, interval)}
              </span>
              <span className="text-sm text-slate-500">
                {periodLabel(individual, interval)}
              </span>
            </div>
            {interval === 'year' && (
              <p className="mt-1 text-xs text-slate-400 line-through">
                ${individual.monthlyPrice}/mo
              </p>
            )}
            <p className="mt-2 text-sm text-slate-500">{individual.tagline}</p>

            <ul className="mt-6 space-y-3">
              {individual.features.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <CheckIcon />
                  <span className="text-sm text-slate-600">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => handleSubscribe('individual')}
              disabled={loading !== null}
              className="mt-8 flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            >
              {loading === 'individual' ? 'Redirecting…' : `Subscribe to ${individual.name}`}
            </button>
          </div>

          {/* Team — coming soon */}
          <div className="relative rounded-2xl border border-slate-200 bg-white p-7 shadow-sm opacity-75">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                Coming Soon
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{team.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-900">
                {formatPrice(team, interval)}
              </span>
              <span className="text-sm text-slate-500">{periodLabel(team, interval)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{team.tagline}</p>

            <ul className="mt-6 space-y-3">
              {team.features.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <CheckIcon />
                  <span className="text-sm text-slate-600">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled
              className="mt-8 flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-100 text-sm font-medium text-slate-400"
            >
              Coming Soon
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-6 text-center text-sm text-rose-600">{error}</p>
        )}

        <p className="mt-10 text-center text-xs text-slate-400">
          Secure checkout by Stripe. Cancel anytime from your account settings.
        </p>
      </div>
    </div>
  );
};

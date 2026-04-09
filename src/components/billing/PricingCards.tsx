// ============================================================
// Plan comparison cards — Free / Pro / Team side by side
// ============================================================

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PLANS, FEATURE_LABELS } from '../../billing/plans';
import type { PlanId, FeatureKey } from '../../types';

interface Props {
  currentPlan: PlanId;
  onManageBilling?: () => Promise<void>;
}

const PLAN_ORDER: PlanId[] = ['free', 'pro', 'team'];

// Feature display order
const FEATURE_DISPLAY: FeatureKey[] = [
  'unlimited_panels', 'history_days', 'daily_summary_full',
  'blocker_tracking', 'unrealized_effort', 'weekly_reports',
  'exports', 'email_tools', 'manager_dashboard', 'team_visibility',
];

export const PricingCards: React.FC<Props> = ({ currentPlan, onManageBilling }) => {
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (plan: PlanId) => {
    if (plan === 'free') return;
    setLoading(plan);
    try {
      // If user already has a paid plan, use billing portal for plan changes
      if (currentPlan !== 'free' && onManageBilling) {
        await onManageBilling();
        return;
      }
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          plan,
          interval,
          mode: plan === 'team' ? 'team' : 'user',
        },
      });
      if (error) throw error;
      if (data?.url) {
        const url = new URL(data.url);
        if (!url.hostname.endsWith('stripe.com')) throw new Error('Invalid checkout redirect');
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="pricing-cards">
      {/* Interval toggle */}
      <div className="pricing-cards__toggle">
        <button
          className={`pricing-cards__interval ${interval === 'month' ? 'pricing-cards__interval--active' : ''}`}
          onClick={() => setInterval('month')}
        >
          Monthly
        </button>
        <button
          className={`pricing-cards__interval ${interval === 'year' ? 'pricing-cards__interval--active' : ''}`}
          onClick={() => setInterval('year')}
        >
          Yearly (save 17%)
        </button>
      </div>

      <div className="pricing-cards__grid">
        {PLAN_ORDER.map(planId => {
          const plan = PLANS[planId];
          const isCurrent = planId === currentPlan;
          const price = interval === 'month'
            ? plan.monthlyPrice / 100
            : plan.yearlyPrice / 1200; // monthly equivalent

          return (
            <div
              key={planId}
              className={`pricing-card ${isCurrent ? 'pricing-card--current' : ''} ${planId === 'pro' ? 'pricing-card--recommended' : ''}`}
            >
              {planId === 'pro' && !isCurrent && (
                <div className="pricing-card__badge">Most Popular</div>
              )}
              {isCurrent && (
                <div className="pricing-card__badge pricing-card__badge--current">Current Plan</div>
              )}

              <h4 className="pricing-card__name">{plan.name}</h4>
              <p className="pricing-card__tagline">{plan.tagline}</p>

              <div className="pricing-card__price">
                {price === 0 ? (
                  <span className="pricing-card__amount">Free</span>
                ) : (
                  <>
                    <span className="pricing-card__amount">${price.toFixed(0)}</span>
                    <span className="pricing-card__per">/{planId === 'team' ? 'seat/mo' : 'mo'}</span>
                  </>
                )}
              </div>

              <ul className="pricing-card__features">
                {FEATURE_DISPLAY.map(fk => {
                  const val = plan.features[fk];
                  const enabled = typeof val === 'boolean' ? val : val > 0;
                  if (fk === 'history_days') {
                    return (
                      <li key={fk} className="pricing-card__feature">
                        {val === 365 ? 'Full year history' : `${val}-day history`}
                      </li>
                    );
                  }
                  return (
                    <li key={fk} className={`pricing-card__feature ${!enabled ? 'pricing-card__feature--disabled' : ''}`}>
                      <span className="pricing-card__check">{enabled ? '\u2713' : '\u2014'}</span>
                      {FEATURE_LABELS[fk]}
                    </li>
                  );
                })}
              </ul>

              {isCurrent ? (
                <button className="btn btn--secondary btn--full" disabled>
                  Current Plan
                </button>
              ) : planId === 'free' ? (
                <button className="btn btn--secondary btn--full" disabled>
                  Free Forever
                </button>
              ) : (
                <button
                  className={`btn btn--full ${planId === 'pro' ? 'btn--primary' : 'btn--accent'}`}
                  onClick={() => handleCheckout(planId)}
                  disabled={loading === planId}
                >
                  {loading === planId ? 'Loading...' : `Get ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

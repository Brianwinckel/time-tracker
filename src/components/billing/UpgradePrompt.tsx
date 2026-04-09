// ============================================================
// Contextual upgrade prompt — friendly, not punitive
// Shows what feature is gated and which plan unlocks it
// ============================================================

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PLANS, FEATURE_LABELS, getUpgradePlan } from '../../billing/plans';
import type { FeatureKey, PlanId } from '../../types';

interface Props {
  feature: FeatureKey;
  currentPlan: PlanId;
  onClose: () => void;
  context?: string;
}

export const UpgradePrompt: React.FC<Props> = ({ feature, currentPlan, onClose, context }) => {
  const [loading, setLoading] = useState(false);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  const targetPlan = getUpgradePlan(feature);
  const plan = PLANS[targetPlan];
  const price = interval === 'month'
    ? `$${(plan.monthlyPrice / 100).toFixed(0)}/mo`
    : `$${(plan.yearlyPrice / 100).toFixed(0)}/yr`;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          plan: targetPlan,
          interval,
          mode: targetPlan === 'team' ? 'team' : 'user',
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
      setLoading(false);
    }
  };

  // Features included in the target plan (that aren't in current plan)
  const upgradedFeatures = (Object.entries(PLANS[targetPlan].features) as [FeatureKey, boolean | number][])
    .filter(([key, val]) => {
      const currentVal = PLANS[currentPlan].features[key];
      return val !== currentVal && (typeof val === 'boolean' ? val : val > (currentVal as number));
    })
    .map(([key]) => FEATURE_LABELS[key])
    .slice(0, 6);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal upgrade-prompt" onClick={e => e.stopPropagation()}>
        <div className="upgrade-prompt__header">
          <h3>Available on {plan.name}</h3>
          <p className="upgrade-prompt__tagline">{plan.tagline}</p>
        </div>

        {context && (
          <p className="upgrade-prompt__context">{context}</p>
        )}

        <div className="upgrade-prompt__feature-highlight">
          <strong>{FEATURE_LABELS[feature]}</strong> is included with {plan.name}.
        </div>

        <ul className="upgrade-prompt__features">
          {upgradedFeatures.map(f => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <div className="upgrade-prompt__pricing">
          <div className="upgrade-prompt__interval-toggle">
            <button
              className={`upgrade-prompt__interval ${interval === 'month' ? 'upgrade-prompt__interval--active' : ''}`}
              onClick={() => setInterval('month')}
            >
              Monthly
            </button>
            <button
              className={`upgrade-prompt__interval ${interval === 'year' ? 'upgrade-prompt__interval--active' : ''}`}
              onClick={() => setInterval('year')}
            >
              Yearly (save 17%)
            </button>
          </div>
          <div className="upgrade-prompt__price">{price}</div>
          {/* Trial removed — Free tier is the trial */}
        </div>

        <div className="modal__actions">
          <button className="btn btn--secondary" onClick={onClose}>
            Maybe later
          </button>
          <button
            className="btn btn--primary"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? 'Opening checkout...' : `Upgrade to ${plan.name}`}
          </button>
        </div>
      </div>
    </div>
  );
};

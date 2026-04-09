// ============================================================
// Billing settings section — current plan, manage, upgrade
// ============================================================

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useEntitlements } from '../../billing/entitlements';
import { PLANS } from '../../billing/plans';
import { PricingCards } from './PricingCards';

export const BillingSettings: React.FC = () => {
  const { entitlements, loading } = useEntitlements();
  const [portalLoading, setPortalLoading] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  if (loading) return <p className="settings__info">Loading billing info...</p>;

  const plan = PLANS[entitlements.plan];
  const isFree = entitlements.plan === 'free';
  const isTrial = entitlements.subscription?.status === 'trialing';
  const isPastDue = entitlements.subscription?.status === 'past_due';
  const willCancel = entitlements.cancelAtPeriodEnd;

  const trialDaysLeft = isTrial && entitlements.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(entitlements.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  const periodEnd = entitlements.subscription?.current_period_end
    ? new Date(entitlements.subscription.current_period_end).toLocaleDateString()
    : null;

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal');
      if (error) throw error;
      if (data?.url) {
        const url = new URL(data.url);
        if (!url.hostname.endsWith('stripe.com')) throw new Error('Invalid portal redirect');
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="billing-settings">
      {/* Current plan status */}
      <div className="billing-status">
        <div className="billing-status__plan">
          <span className="billing-status__plan-name">{plan.name}</span>
          {isTrial && <span className="billing-status__badge billing-status__badge--trial">Trial</span>}
          {isPastDue && <span className="billing-status__badge billing-status__badge--warning">Payment Issue</span>}
          {willCancel && <span className="billing-status__badge billing-status__badge--warning">Canceling</span>}
        </div>

        {isTrial && trialDaysLeft > 0 && (
          <p className="billing-status__detail">
            {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left in your free trial
          </p>
        )}

        {!isFree && periodEnd && (
          <p className="billing-status__detail">
            {willCancel ? 'Access until' : 'Next billing date'}: {periodEnd}
          </p>
        )}

        {isPastDue && (
          <p className="billing-status__warning">
            Your payment failed. Please update your payment method to keep your {plan.name} features.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="billing-actions">
        {isFree ? (
          <button className="btn btn--primary" onClick={() => setShowPricing(!showPricing)}>
            {showPricing ? 'Hide Plans' : 'Upgrade'}
          </button>
        ) : (
          <>
            <button
              className="btn btn--secondary"
              onClick={handleManageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? 'Opening...' : 'Manage Subscription'}
            </button>
            <button className="btn btn--secondary" onClick={() => setShowPricing(!showPricing)}>
              {showPricing ? 'Hide Plans' : 'Change Plan'}
            </button>
          </>
        )}
      </div>

      {/* Pricing cards */}
      {showPricing && (
        <div style={{ marginTop: '16px' }}>
          <PricingCards currentPlan={entitlements.plan} onManageBilling={handleManageBilling} />
        </div>
      )}
    </div>
  );
};

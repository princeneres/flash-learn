import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, Check, Loader2 } from 'lucide-react';
import {
  SubscriptionService,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
  type SubscriptionState,
} from '../services/SubscriptionService';
import { usePlan } from '../hooks/usePlan';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PLAN_LABELS: Record<SubscriptionPlanId, string> = {
  pro_monthly: 'plan.proMonthly',
  pro_annual: 'plan.proAnnual',
};

// Pro perks surfaced on the upgrade card; mirror the features set on the 'pro' plan row.
const PRO_PERKS = ['plan.perkDecks', 'plan.perkStats', 'plan.perkExport', 'plan.perkCredits'];

export const PlanSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { isPro, refresh } = usePlan();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [busy, setBusy] = useState<SubscriptionPlanId | null>(null);

  const loadState = async () => {
    try {
      setState(await SubscriptionService.getState());
    } catch {
      setState(null);
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

  // Returning from a successful subscription checkout (?plan=success): the webhook may
  // take a moment, so re-sync plan/state and surface a confirmation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('plan') === 'success') {
      toast({ title: t('plan.upgradeSuccess') });
      void refresh();
      void loadState();
      params.delete('plan');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubscribe = async (planId: SubscriptionPlanId) => {
    setBusy(planId);
    try {
      const url = await SubscriptionService.startCheckout(planId);
      window.location.href = url;
    } catch (err) {
      console.error(err);
      toast({ title: t('plan.checkoutError'), variant: 'destructive' });
      setBusy(null);
    }
  };

  const dateFmt = new Intl.DateTimeFormat(i18n.language?.startsWith('pt') ? 'pt-BR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-warm" />
          <div>
            <p className="font-medium">{t('plan.title')}</p>
            <p className="text-xs text-muted-foreground">{t('plan.subtitle')}</p>
          </div>
        </div>
        <span
          className={
            isPro
              ? 'rounded-full bg-warm/10 px-3 py-1 text-sm font-semibold text-warm'
              : 'rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground'
          }
        >
          {isPro ? t('plan.badgePro') : t('plan.badgeFree')}
        </span>
      </div>

      {isPro ? (
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{t('plan.activeDescription')}</p>
          {state?.current_period_end && (
            <p>
              {state.status === 'canceled'
                ? t('plan.endsOn', { date: dateFmt.format(new Date(state.current_period_end)) })
                : t('plan.renewsOn', { date: dateFmt.format(new Date(state.current_period_end)) })}
            </p>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-1.5 text-sm">
            {PRO_PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                {t(perk)}
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 text-center"
              >
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {t(PLAN_LABELS[plan.id])}
                </span>
                <span className="text-2xl font-bold">{formatBRL(plan.priceCents)}</span>
                <span className="text-xs text-muted-foreground">
                  {t('plan.includedCredits', { count: plan.includedCredits })}
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={busy !== null}
                >
                  {busy === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('plan.upgrade')
                  )}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

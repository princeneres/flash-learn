import { useCallback, useEffect, useState } from 'react';
import { PlanService, type PlanLimits } from '../services/PlanService';
import { useAuth } from '../context/AuthContext';

export interface UsePlanResult {
  limits: PlanLimits | null;
  loading: boolean;
  refresh: () => Promise<void>;
  isPro: boolean;
  features: Record<string, unknown>;
}

export const usePlan = (): UsePlanResult => {
  const { currentUser } = useAuth();
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentUser) {
      setLimits(null);
      return;
    }
    setLoading(true);
    try {
      const next = await PlanService.getLimits();
      setLimits(next);
    } catch (err) {
      console.error('Failed to load plan limits', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isPro = limits?.plan.id === 'pro';
  const features = limits?.plan.features ?? {};

  return { limits, loading, refresh, isPro, features };
};

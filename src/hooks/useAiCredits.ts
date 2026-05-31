import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AiCreditService } from '../services/AiCreditService';

interface UseAiCredits {
  balance: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

// Reads the authenticated user's AI credit balance. Call refresh() after a
// generation (balance dropped) or when returning from a successful checkout.
export const useAiCredits = (): UseAiCredits => {
  const { currentUser } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentUser?.id) {
      setBalance(null);
      return;
    }
    setLoading(true);
    try {
      setBalance(await AiCreditService.getBalance());
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, loading, refresh };
};

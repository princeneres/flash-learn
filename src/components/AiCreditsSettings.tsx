import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Sparkles, Loader2 } from 'lucide-react';
import {
  AiCreditService,
  CREDIT_PACKS,
  type CreditPackId,
  type LedgerEntry,
} from '../services/AiCreditService';
import { useAiCredits } from '../hooks/useAiCredits';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PACK_LABELS: Record<CreditPackId, string> = {
  starter: 'ai.credits.packStarter',
  popular: 'ai.credits.packPopular',
  pro: 'ai.credits.packPro',
};

export const AiCreditsSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { balance, refresh } = useAiCredits();
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [buying, setBuying] = useState<CreditPackId | null>(null);

  const loadHistory = async () => {
    try {
      setHistory(await AiCreditService.getHistory());
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  // Returning from a successful checkout (?credits=success): the webhook may take
  // a moment, so re-sync balance and history and surface a confirmation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('credits') === 'success') {
      toast({ title: t('ai.credits.purchaseSuccess') });
      void refresh();
      void loadHistory();
      params.delete('credits');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuy = async (packId: CreditPackId) => {
    setBuying(packId);
    try {
      const url = await AiCreditService.startCheckout(packId);
      window.location.href = url;
    } catch (err) {
      console.error(err);
      toast({ title: t('ai.credits.checkoutError'), variant: 'destructive' });
      setBuying(null);
    }
  };

  const dateFmt = new Intl.DateTimeFormat(i18n.language?.startsWith('pt') ? 'pt-BR' : 'en-US', {
    day: '2-digit',
    month: 'short',
  });

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">{t('ai.credits.title')}</p>
            <p className="text-xs text-muted-foreground">{t('ai.credits.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-warm/10 px-3 py-1 text-sm font-semibold text-warm">
          <Coins className="h-4 w-4" />
          {balance ?? 0}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 text-center"
          >
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {t(PACK_LABELS[pack.id])}
            </span>
            <span className="text-2xl font-bold">{pack.credits}</span>
            <span className="text-xs text-muted-foreground">
              {t('ai.credits.perGeneration', { count: pack.credits })}
            </span>
            <span className="text-sm font-semibold">{formatBRL(pack.priceCents)}</span>
            <Button
              type="button"
              size="sm"
              onClick={() => handleBuy(pack.id)}
              disabled={buying !== null}
            >
              {buying === pack.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('ai.credits.buy')
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{t('ai.credits.history')}</p>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('ai.credits.historyEmpty')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {dateFmt.format(new Date(entry.created_at))} ·{' '}
                  {t(`ai.credits.reason.${entry.reason}`, entry.reason)}
                </span>
                <span
                  className={
                    entry.delta > 0 ? 'font-medium text-green-600' : 'text-muted-foreground'
                  }
                >
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

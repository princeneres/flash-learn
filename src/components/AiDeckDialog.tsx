import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Trash2, ArrowLeft, Wand2, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  LlmService,
  MAX_CARDS_PER_GENERATION,
  LlmError,
  llmErrorKey,
  type Difficulty,
  type GeneratedCard,
} from '../services/LlmService';
import { AiCreditService } from '../services/AiCreditService';
import { useAiCredits } from '../hooks/useAiCredits';
import { DeckService } from '../services/DeckService';
import { CardService } from '../services/CardService';
import { parsePlanError, planErrorTitle } from '../lib/planErrors';
import { MONETIZATION_ENABLED } from '../lib/features';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from './ui/use-toast';

interface AiDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxCardsPerDeck: number;
  totalRoom: number;
  onCreated: () => void;
}

const DEFAULT_COUNT = 15;

export const AiDeckDialog: React.FC<AiDeckDialogProps> = ({
  open,
  onOpenChange,
  maxCardsPerDeck,
  totalRoom,
  onCreated,
}) => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const uid = currentUser?.id ?? '';
  const { balance, refresh: refreshCredits } = useAiCredits();
  const hasCredits = (balance ?? 0) > 0;
  const maxAllowed = Math.max(0, Math.min(maxCardsPerDeck, totalRoom, MAX_CARDS_PER_GENERATION));
  const [buying, setBuying] = useState(false);

  const handleBuyCredits = async () => {
    setBuying(true);
    try {
      const url = await AiCreditService.startCheckout('popular');
      window.location.href = url;
    } catch (err) {
      console.error(err);
      toast({ title: t('ai.credits.checkoutError'), variant: 'destructive' });
      setBuying(false);
    }
  };

  const defaultLanguage = i18n.language?.startsWith('pt') ? 'Português' : 'English';

  const [theme, setTheme] = useState('');
  const [count, setCount] = useState(Math.min(DEFAULT_COUNT, maxAllowed));
  const [language, setLanguage] = useState(defaultLanguage);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [instructions, setInstructions] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<GeneratedCard[] | null>(null);
  const [deckTitle, setDeckTitle] = useState('');

  const step: 'form' | 'preview' = cards ? 'preview' : 'form';

  const reset = () => {
    setTheme('');
    setCount(Math.min(DEFAULT_COUNT, maxAllowed));
    setLanguage(defaultLanguage);
    setDifficulty('intermediate');
    setInstructions('');
    setIsPublic(false);
    setCards(null);
    setDeckTitle('');
    setGenerating(false);
    setSaving(false);
  };

  // Keep the count within the allowed room whenever the dialog (re)opens.
  useEffect(() => {
    if (open) setCount((c) => Math.min(Math.max(1, c), Math.max(1, maxAllowed)));
  }, [open, maxAllowed]);

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const handleGenerate = async () => {
    if (!theme.trim()) {
      toast({ title: t('ai.generate.themeRequired'), variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const result = await LlmService.generateCards({
        theme: theme.trim(),
        count: Math.min(count, maxAllowed),
        language: language.trim() || defaultLanguage,
        difficulty,
        instructions,
      });
      setCards(result);
      setDeckTitle(theme.trim());
      // A credit was spent server-side; reflect the new balance.
      void refreshCredits();
    } catch (err) {
      console.error(err);
      toast({ title: t(llmErrorKey(err)), variant: 'destructive' });
      // On insufficient credits the balance is authoritative — re-sync it.
      if (err instanceof LlmError && err.code === 'NO_CREDITS') void refreshCredits();
    } finally {
      setGenerating(false);
    }
  };

  const updateCard = (index: number, patch: Partial<GeneratedCard>) => {
    setCards((prev) => (prev ? prev.map((c, i) => (i === index ? { ...c, ...patch } : c)) : prev));
  };

  const removeCard = (index: number) => {
    setCards((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  };

  const validCards = useMemo(
    () => (cards ?? []).filter((c) => c.front.trim() && c.back.trim()),
    [cards],
  );

  const handleConfirm = async () => {
    if (!deckTitle.trim() || validCards.length === 0) return;
    setSaving(true);
    try {
      const deckId = await DeckService.createDeck(uid, {
        title: deckTitle.trim(),
        category: 'AI',
        tags: [],
        isPublic,
      });
      const toSave = validCards.slice(0, maxCardsPerDeck);
      await CardService.bulkCreateCards(
        uid,
        deckId,
        toSave.map((c) => ({ front: c.front.trim(), back: c.back.trim(), tags: c.tags })),
      );
      toast({ title: t('ai.generate.created', { count: toSave.length }) });
      onCreated();
      handleClose(false);
    } catch (err) {
      console.error(err);
      const plan = parsePlanError(err);
      toast({
        title: plan ? planErrorTitle(plan, t) : t('ai.generate.saveError'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderBody = () => {
    if (!hasCredits) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('ai.generate.noCredits')}</p>
          {MONETIZATION_ENABLED && (
            <Button type="button" onClick={handleBuyCredits} disabled={buying}>
              <Coins className="mr-2 h-4 w-4" />
              {buying ? t('ai.credits.buying') : t('ai.generate.buyCredits')}
            </Button>
          )}
        </div>
      );
    }

    if (maxAllowed <= 0) {
      return <p className="text-sm text-muted-foreground">{t('ai.generate.noRoom')}</p>;
    }

    if (step === 'preview' && cards) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-deck-title">{t('ai.generate.deckTitle')}</Label>
            <Input
              id="ai-deck-title"
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              placeholder={t('dashboard.titlePlaceholder')}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t('ai.generate.previewCount', { count: validCards.length })}
          </p>

          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {cards.map((card, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeCard(i)}
                    className="rounded-full p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('ai.generate.removeCard')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Textarea
                  value={card.front}
                  onChange={(e) => updateCard(i, { front: e.target.value })}
                  placeholder={t('deckDetail.frontPlaceholder')}
                  className="min-h-[60px]"
                />
                <Textarea
                  value={card.back}
                  onChange={(e) => updateCard(i, { back: e.target.value })}
                  placeholder={t('deckDetail.backPlaceholder')}
                  className="min-h-[60px]"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 p-3">
            <span className="text-sm font-medium">{t('visibility.fieldLabel')}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{isPublic ? t('visibility.public') : t('visibility.private')}</span>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-theme">{t('ai.generate.themeLabel')}</Label>
          <Input
            id="ai-theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder={t('ai.generate.themePlaceholder')}
            autoFocus
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-count">{t('ai.generate.countLabel', { max: maxAllowed })}</Label>
            <Input
              id="ai-count"
              type="number"
              min={1}
              max={maxAllowed}
              value={count}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setCount(Number.isNaN(n) ? 1 : Math.min(Math.max(1, n), maxAllowed));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-difficulty">{t('ai.generate.difficultyLabel')}</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger id="ai-difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">{t('ai.generate.beginner')}</SelectItem>
                <SelectItem value="intermediate">{t('ai.generate.intermediate')}</SelectItem>
                <SelectItem value="advanced">{t('ai.generate.advanced')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-language">{t('ai.generate.languageLabel')}</Label>
          <Input id="ai-language" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-instructions">{t('ai.generate.instructionsLabel')}</Label>
          <Textarea
            id="ai-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t('ai.generate.instructionsPlaceholder')}
            className="min-h-[80px]"
          />
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          {t('ai.generate.creditCost', { count: balance ?? 0 })}
        </p>
      </div>
    );
  };

  const renderFooter = () => {
    if (!hasCredits || maxAllowed <= 0) {
      return (
        <Button type="button" variant="ghost" onClick={() => handleClose(false)}>
          {t('common.cancel')}
        </Button>
      );
    }

    if (step === 'preview') {
      return (
        <>
          <Button type="button" variant="ghost" onClick={() => setCards(null)} disabled={saving}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('ai.generate.back')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={saving || validCards.length === 0 || !deckTitle.trim()}
          >
            {saving
              ? t('ai.generate.creating')
              : t('ai.generate.confirm', { count: validCards.length })}
          </Button>
        </>
      );
    }

    return (
      <>
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleClose(false)}
          disabled={generating}
        >
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={handleGenerate} disabled={generating || !theme.trim()}>
          <Wand2 className="mr-2 h-4 w-4" />
          {generating ? t('ai.generate.generating') : t('ai.generate.generate')}
        </Button>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('ai.generate.title')}
          </DialogTitle>
        </DialogHeader>
        {renderBody()}
        <DialogFooter className="mt-6">{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

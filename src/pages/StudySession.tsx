import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CardService, type Card } from "../services/CardService";
import { DeckService, type Deck } from "../services/DeckService";
import { Button } from "../components/ui/button";
import { ArrowLeft, CheckCircle, Trophy, RotateCcw, Brain, ThumbsUp, Zap, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { LoadingState } from "../components/LoadingState";
import { useToast } from "../components/ui/use-toast";

const StudySession: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    if (deckId) {
      loadSession();
    }
  }, [deckId]);

  const loadSession = async () => {
    try {
      const [deckData, cardsData] = await Promise.all([
        DeckService.getDeck(deckId!),
        CardService.getDueCards(deckId!)
      ]);
      
      if (!deckData) {
        toast({ title: t('study.deckNotFound'), variant: 'destructive' });
        navigate('/');
        return;
      }

      setDeck(deckData);
      setDueCards(cardsData);
    } catch (error) {
      console.error(error);
      toast({ title: t('study.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (quality: number) => {
    const currentCard = dueCards[currentIndex];
    try {
      await CardService.processReview(currentCard, quality);
      
      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
      } else {
        setSessionComplete(true);
      }
    } catch (error) {
      console.error(error);
      toast({ title: t('study.saveError'), variant: 'destructive' });
    }
  };

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (!deck) return null;

  if (sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-green-500/20 blur-2xl" />
          <div className="relative rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 p-8 ring-1 ring-green-500/20">
            <Sparkles className="h-16 w-16 text-green-500 drop-shadow-lg" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('study.finished')}</h2>
          <p className="text-muted-foreground max-w-sm">{t('study.completeMessage')}</p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => navigate('/leaderboard')} className="gap-2 rounded-xl px-5">
            <Trophy className="h-4 w-4" />
            {t('study.viewLeaderboard')}
          </Button>
          <Button onClick={() => navigate('/')} className="rounded-xl px-5">
            {t('study.backToDashboard')}
          </Button>
        </div>
      </div>
    );
  }

  if (dueCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl" />
          <div className="relative rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/10 p-8 ring-1 ring-blue-500/20">
            <CheckCircle className="w-16 h-16 text-blue-500 drop-shadow-lg" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('study.noCardsTitle')}</h2>
          <p className="text-muted-foreground max-w-sm">{t('study.noCardsBody')}</p>
        </div>
        <Button onClick={() => navigate('/')} className="rounded-xl px-5">
          {t('study.backToDashboard')}
        </Button>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];
  const progress = ((currentIndex) / dueCards.length) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={() => navigate('/')} className="w-fit gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold tabular-nums text-muted-foreground">
            {t('study.progressCounter', { current: currentIndex + 1, total: dueCards.length })}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flashcard */}
      <div
        className="group relative cursor-pointer rounded-3xl border border-border/60 bg-card/80 p-1 shadow-2xl transition-shadow duration-300 hover:shadow-primary/10 hover:shadow-[0_8px_40px]"
        onClick={() => !isFlipped && setIsFlipped(true)}
      >
        <div className="rounded-[22px] border border-white/5 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-8 sm:p-10">
          <div className="perspective-1000 min-h-[360px]">
            <div className={clsx(
              "relative w-full min-h-[320px] transition-all duration-500 transform-style-3d",
              isFlipped ? "rotate-y-180" : ""
            )}>
              {/* Front */}
              <div className={clsx(
                "absolute inset-0 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-border/60 bg-card px-8 text-center shadow-xl backface-hidden",
                isFlipped && "opacity-0"
              )}>
                <p className="text-xl sm:text-2xl font-semibold leading-relaxed">{currentCard.front}</p>
                <span className="mt-10 inline-flex items-center gap-2 rounded-full bg-muted/50 px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  {t('study.showAnswer')}
                </span>
              </div>
              {/* Back */}
              <div className={clsx(
                "absolute inset-0 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-border/60 bg-card px-8 text-center shadow-xl backface-hidden rotate-y-180",
                !isFlipped && "opacity-0"
              )}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
                  {t('study.answerLabel')}
                </span>
                <p className="mt-6 text-2xl sm:text-3xl font-bold text-primary leading-relaxed">
                  {currentCard.back}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {isFlipped && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            onClick={() => handleRate(1)}
            className="group/btn relative flex flex-col items-center gap-2 rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-500/10 to-red-500/5 px-4 py-5 text-center transition-all duration-200 hover:border-red-500/40 hover:from-red-500/20 hover:to-red-500/10 hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15 transition-colors group-hover/btn:bg-red-500/25">
              <RotateCcw className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-sm font-bold text-red-500">{t('study.again')}</span>
            <span className="text-[11px] font-medium text-muted-foreground">&lt; 1m</span>
          </button>
          <button
            onClick={() => handleRate(3)}
            className="group/btn relative flex flex-col items-center gap-2 rounded-2xl border border-orange-500/20 bg-gradient-to-b from-orange-500/10 to-orange-500/5 px-4 py-5 text-center transition-all duration-200 hover:border-orange-500/40 hover:from-orange-500/20 hover:to-orange-500/10 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 transition-colors group-hover/btn:bg-orange-500/25">
              <Brain className="h-4 w-4 text-orange-500" />
            </div>
            <span className="text-sm font-bold text-orange-500">{t('study.hard')}</span>
            <span className="text-[11px] font-medium text-muted-foreground">2d</span>
          </button>
          <button
            onClick={() => handleRate(4)}
            className="group/btn relative flex flex-col items-center gap-2 rounded-2xl border border-green-500/20 bg-gradient-to-b from-green-500/10 to-green-500/5 px-4 py-5 text-center transition-all duration-200 hover:border-green-500/40 hover:from-green-500/20 hover:to-green-500/10 hover:shadow-lg hover:shadow-green-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/15 transition-colors group-hover/btn:bg-green-500/25">
              <ThumbsUp className="h-4 w-4 text-green-500" />
            </div>
            <span className="text-sm font-bold text-green-500">{t('study.good')}</span>
            <span className="text-[11px] font-medium text-muted-foreground">4d</span>
          </button>
          <button
            onClick={() => handleRate(5)}
            className="group/btn relative flex flex-col items-center gap-2 rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-500/10 to-blue-500/5 px-4 py-5 text-center transition-all duration-200 hover:border-blue-500/40 hover:from-blue-500/20 hover:to-blue-500/10 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 transition-colors group-hover/btn:bg-blue-500/25">
              <Zap className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-sm font-bold text-blue-500">{t('study.easy')}</span>
            <span className="text-[11px] font-medium text-muted-foreground">7d</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default StudySession;

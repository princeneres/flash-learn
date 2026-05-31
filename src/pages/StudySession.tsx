import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CardService, type Card } from '../services/CardService';
import { DeckService, type Deck } from '../services/DeckService';
import { previewReview } from '../services/srsAlgorithm';
import { getNewLimit, getTypeAnswer } from '../lib/studyLimits';
import { hasCloze } from '../lib/cloze';
import { answersMatch, toPlainText } from '../lib/answer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Trophy,
  RotateCcw,
  Brain,
  ThumbsUp,
  Zap,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { clsx } from 'clsx';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ui/use-toast';
import { PlayAudioButton } from '../components/PlayAudioButton';
import { RichContent } from '../components/RichContent';
import { useSound } from '../hooks/useSound';

const StudySession: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { enabled: soundEnabled, toggle: toggleSound, play } = useSound();

  const [deck, setDeck] = useState<Deck | null>(null);
  // Cards still needing a passing grade this session. A card leaves the queue
  // only when rated Good/Easy; a lapse re-appends it so it comes back.
  const [queue, setQueue] = useState<Card[]>([]);
  const [initialTotal, setInitialTotal] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  // "Type the answer" mode state, reset per card.
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const typeAnswerPref = deckId ? getTypeAnswer(deckId) : false;

  useEffect(() => {
    if (deckId) {
      loadSession();
    }
  }, [deckId]);

  const loadSession = async () => {
    try {
      const [deckData, cardsData] = await Promise.all([
        DeckService.getDeck(deckId!),
        CardService.getDueCards(deckId!, getNewLimit(deckId!)),
      ]);

      if (!deckData) {
        toast({ title: t('study.deckNotFound'), variant: 'destructive' });
        navigate('/');
        return;
      }

      setDeck(deckData);
      setQueue(cardsData);
      setInitialTotal(cardsData.length);
    } catch (error) {
      console.error(error);
      toast({ title: t('study.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const flip = useCallback(() => {
    setIsFlipped((prev) => {
      if (!prev) play('flip');
      return true;
    });
  }, [play]);

  // Type-answer mode: lock in the typed answer and reveal the back.
  const checkAnswer = useCallback(() => {
    setChecked(true);
    flip();
  }, [flip]);

  const handleRate = async (quality: number) => {
    const currentCard = queue[0];
    if (!currentCard) return;
    play(quality < 3 ? 'again' : quality >= 5 ? 'easy' : 'good');
    try {
      const result = await CardService.processReview(
        currentCard,
        quality,
        deck?.category,
        deck?.srsSettings,
      );
      setQueue((prev) => {
        const [, ...rest] = prev;
        // A card stays in this session's queue while it's still walking through
        // the minute-based (re)learning steps; it leaves once it graduates to
        // the day-based review schedule.
        const stillLearning = result.status === 'learning' || result.status === 'relearning';
        if (stillLearning) {
          // Carry the freshly persisted SRS state so the next pass this
          // session schedules from the right baseline.
          const updated: Card = {
            ...currentCard,
            interval: result.interval,
            easeFactor: result.easeFactor,
            repetitions: result.repetitions,
            nextReview: result.nextReview.toISOString(),
            status: result.status,
          };
          return [...rest, updated];
        }
        return rest;
      });
      setIsFlipped(false);
      setTyped('');
      setChecked(false);
    } catch (error) {
      console.error(error);
      toast({ title: t('study.saveError'), variant: 'destructive' });
    }
  };

  const intervalLabel = (card: Card, quality: number): string => {
    const result = previewReview(quality, card, deck?.srsSettings);
    if (result.status === 'learning' || result.status === 'relearning') {
      const minutes = Math.max(1, Math.round((result.nextReview.getTime() - Date.now()) / 60000));
      return t('study.intervalMinutes', { count: minutes });
    }
    const days = result.interval;
    if (days < 30) return t('study.intervalDays', { count: days });
    if (days < 365) return t('study.intervalMonths', { count: Math.round(days / 30) });
    return t('study.intervalYears', { count: Math.round(days / 365) });
  };

  // Celebrate once when the last due card is cleared.
  const completePlayed = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (initialTotal > 0 && queue.length === 0 && !completePlayed.current) {
      completePlayed.current = true;
      play('complete');
    }
  }, [loading, initialTotal, queue.length, play]);

  // Keyboard: Space/Enter flips; 1–4 rate the revealed card.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
        return;
      const card = queue[0];
      if (!card) return;
      // In type-answer mode the back is revealed by submitting the input, not
      // by Space/Enter, so don't shortcut-flip plain cards there.
      const tMode = deckId ? getTypeAnswer(deckId) && !hasCloze(card.front) : false;
      if (!isFlipped) {
        if (!tMode && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault();
          flip();
        }
        return;
      }
      const ratings: Record<string, number> = { '1': 1, '2': 3, '3': 4, '4': 5 };
      const quality = ratings[e.key];
      if (quality) {
        e.preventDefault();
        void handleRate(quality);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // handleRate is stable enough for this listener; re-bind on flip/queue change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped, queue, flip]);

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (!deck) return null;

  if (initialTotal > 0 && queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-warm/25 blur-2xl" />
          <div className="relative rounded-full bg-gradient-to-br from-warm/25 to-amber-400/10 p-8 ring-1 ring-warm/30">
            <Sparkles className="h-16 w-16 text-warm drop-shadow-lg" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('study.finished')}</h2>
          <p className="text-muted-foreground max-w-sm">{t('study.completeMessage')}</p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => navigate('/leaderboard')}
            className="gap-2 rounded-xl px-5"
          >
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

  if (initialTotal === 0) {
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

  const currentCard = queue[0];
  const passed = initialTotal - queue.length;
  const progress = initialTotal > 0 ? (passed / initialTotal) * 100 : 0;

  const isCloze = hasCloze(currentCard.front);
  // Type-answer applies to plain cards only; cloze has its own reveal flow.
  const typeMode = typeAnswerPref && !isCloze;
  const answerCorrect = typeMode && checked ? answersMatch(typed, currentCard.back) : false;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={() => navigate('/')} className="w-fit gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>
        <div className="flex items-center gap-3">
          <div
            className="text-sm font-semibold tabular-nums text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            {t('study.progressCounter', {
              current: Math.min(passed + 1, initialTotal),
              total: initialTotal,
            })}
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? t('study.muteSound') : t('study.unmuteSound')}
            aria-pressed={!soundEnabled}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-foreground/80 transition-colors hover:bg-warm/20 hover:text-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" aria-hidden />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('study.progressCounter', {
          current: Math.min(passed + 1, initialTotal),
          total: initialTotal,
        })}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-warm to-amber-300 transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flashcard */}
      <div
        role="button"
        tabIndex={isFlipped || typeMode ? -1 : 0}
        aria-label={t('study.showAnswer')}
        className={clsx(
          'group relative rounded-3xl border border-border/60 bg-card/80 p-1 shadow-2xl transition-shadow duration-300 hover:shadow-primary/10 hover:shadow-[0_8px_40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          !typeMode && 'cursor-pointer',
        )}
        onClick={() => !isFlipped && !typeMode && flip()}
        onKeyDown={(e) => {
          if (!typeMode && !isFlipped && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            flip();
          }
        }}
      >
        <div className="rounded-[22px] border border-white/5 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-3 sm:p-10">
          <div className="perspective-1000 min-h-[240px] sm:min-h-[360px]">
            <div
              className={clsx(
                'relative w-full min-h-[220px] sm:min-h-[320px] transition-transform duration-500 transform-style-3d motion-reduce:transition-none',
                isFlipped ? 'rotate-y-180' : '',
              )}
            >
              {/* Front */}
              <div
                className={clsx(
                  'absolute inset-0 flex min-h-[220px] sm:min-h-[320px] flex-col items-center justify-center overflow-y-auto rounded-2xl border border-border/60 bg-card px-4 py-6 text-center shadow-xl backface-hidden sm:px-8',
                  isFlipped && 'opacity-0',
                )}
              >
                <RichContent
                  key={`front-${currentCard.id}`}
                  html={currentCard.front}
                  ownerId={currentCard.ownerId}
                  className="rich-text w-full max-w-full break-words [overflow-wrap:anywhere] text-lg sm:text-2xl font-semibold leading-relaxed"
                  autoplayFirst={!isFlipped}
                  clozeMode={isCloze ? 'front' : undefined}
                />
                {currentCard.frontAudio && (
                  <div className="mt-4">
                    <PlayAudioButton
                      audioRef={currentCard.frontAudio}
                      ownerId={currentCard.ownerId}
                      autoplay={!isFlipped}
                    />
                  </div>
                )}
                {!typeMode && (
                  <span className="mt-6 sm:mt-10 inline-flex items-center gap-2 rounded-full bg-muted/50 px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    {t('study.showAnswer')}
                  </span>
                )}
              </div>
              {/* Back */}
              <div
                className={clsx(
                  'absolute inset-0 flex min-h-[220px] sm:min-h-[320px] flex-col items-center justify-center overflow-y-auto rounded-2xl border border-border/60 bg-card px-4 py-6 text-center shadow-xl backface-hidden rotate-y-180 sm:px-8',
                  !isFlipped && 'opacity-0',
                )}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
                  {t('study.answerLabel')}
                </span>
                {isCloze ? (
                  <>
                    <RichContent
                      key={`cloze-back-${currentCard.id}`}
                      html={currentCard.front}
                      ownerId={currentCard.ownerId}
                      className="rich-text mt-6 w-full max-w-full break-words [overflow-wrap:anywhere] text-xl sm:text-3xl font-bold leading-relaxed"
                      autoplayFirst={isFlipped}
                      clozeMode="back"
                    />
                    {currentCard.back && (
                      <RichContent
                        key={`cloze-notes-${currentCard.id}`}
                        html={currentCard.back}
                        ownerId={currentCard.ownerId}
                        className="rich-text mt-4 w-full max-w-full break-words [overflow-wrap:anywhere] text-base text-muted-foreground leading-relaxed"
                      />
                    )}
                  </>
                ) : (
                  <RichContent
                    key={`back-${currentCard.id}`}
                    html={currentCard.back}
                    ownerId={currentCard.ownerId}
                    className="rich-text mt-6 w-full max-w-full break-words [overflow-wrap:anywhere] text-xl sm:text-3xl font-bold text-primary leading-relaxed"
                    autoplayFirst={isFlipped}
                  />
                )}
                {currentCard.backAudio && (
                  <div className="mt-4">
                    <PlayAudioButton
                      audioRef={currentCard.backAudio}
                      ownerId={currentCard.ownerId}
                      autoplay={isFlipped}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Type-answer input */}
      {typeMode && (
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!checked && typed.trim()) checkAnswer();
            }}
            className="flex gap-2"
          >
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={checked}
              autoFocus
              placeholder={t('study.typeAnswerPlaceholder')}
              aria-label={t('study.typeAnswerPlaceholder')}
              className={clsx(
                'rounded-xl',
                checked &&
                  (answerCorrect
                    ? 'border-green-500 focus-visible:ring-green-500'
                    : 'border-red-500 focus-visible:ring-red-500'),
              )}
            />
            {!checked && (
              <Button type="submit" disabled={!typed.trim()} className="rounded-xl">
                {t('study.checkAnswer')}
              </Button>
            )}
          </form>
          {checked && (
            <div
              className={clsx(
                'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium',
                answerCorrect
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400',
              )}
            >
              {answerCorrect ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>
                {answerCorrect
                  ? t('study.answerCorrect')
                  : t('study.answerIncorrect', { answer: toPlainText(currentCard.back) })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Rating buttons */}
      {isFlipped && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            onClick={() => handleRate(1)}
            className="group/btn relative flex flex-col items-center gap-2 rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-500/10 to-red-500/5 px-4 py-5 text-center transition duration-200 hover:border-red-500/40 hover:from-red-500/20 hover:to-red-500/10 hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15 transition-colors group-hover/btn:bg-red-500/25">
              <RotateCcw className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-sm font-bold text-red-500">{t('study.again')}</span>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {intervalLabel(currentCard, 1)}
            </span>
          </button>
          <button
            onClick={() => handleRate(3)}
            className="group/btn relative flex flex-col items-center gap-2 rounded-2xl border border-orange-500/20 bg-gradient-to-b from-orange-500/10 to-orange-500/5 px-4 py-5 text-center transition duration-200 hover:border-orange-500/40 hover:from-orange-500/20 hover:to-orange-500/10 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 transition-colors group-hover/btn:bg-orange-500/25">
              <Brain className="h-4 w-4 text-orange-500" />
            </div>
            <span className="text-sm font-bold text-orange-500">{t('study.hard')}</span>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {intervalLabel(currentCard, 3)}
            </span>
          </button>
          <button
            onClick={() => handleRate(4)}
            className="group/btn relative flex flex-col items-center gap-2 rounded-2xl border border-green-500/20 bg-gradient-to-b from-green-500/10 to-green-500/5 px-4 py-5 text-center transition duration-200 hover:border-green-500/40 hover:from-green-500/20 hover:to-green-500/10 hover:shadow-lg hover:shadow-green-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/15 transition-colors group-hover/btn:bg-green-500/25">
              <ThumbsUp className="h-4 w-4 text-green-500" />
            </div>
            <span className="text-sm font-bold text-green-500">{t('study.good')}</span>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {intervalLabel(currentCard, 4)}
            </span>
          </button>
          <button
            onClick={() => handleRate(5)}
            className="group/btn relative flex flex-col items-center gap-2 rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-amber-500/5 px-4 py-5 text-center transition duration-200 hover:border-amber-500/50 hover:from-amber-500/20 hover:to-amber-500/10 hover:shadow-lg hover:shadow-amber-500/15 hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 transition-colors group-hover/btn:bg-amber-500/25">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
              {t('study.easy')}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {intervalLabel(currentCard, 5)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default StudySession;

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Trophy, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import {
  QuizService,
  type Quiz,
  type QuizQuestion,
  type QuizAnswer,
} from '../services/QuizService';
import { useAuth } from '../context/AuthContext';
import { useSound } from '../hooks/useSound';
import { Button } from '../components/ui/button';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ui/use-toast';
import { cn } from '../lib/utils';

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

const QuizSession: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { play } = useSound();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (quizId) void load();
  }, [quizId]);

  const load = async () => {
    try {
      const [q, qs] = await Promise.all([
        QuizService.getQuiz(quizId!),
        QuizService.getQuizQuestions(quizId!),
      ]);
      if (!q) {
        toast({ title: t('quiz.notFound'), variant: 'destructive' });
        navigate('/collections');
        return;
      }
      setQuiz(q);
      setQuestions(qs);
    } catch (error) {
      console.error(error);
      toast({ title: t('quiz.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const current = questions[index];
  const correctIds = useMemo(
    () => (current ? current.options.filter((o) => o.correct).map((o) => o.id) : []),
    [current],
  );
  const isCorrect = checked && sameSet(selected, correctIds);
  const score = answers.filter((a) => a.correct).length;

  const toggleSelect = (id: string) => {
    if (checked) return;
    if (current.kind === 'multiple') {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setSelected([id]);
    }
  };

  const handleCheck = () => {
    if (selected.length === 0) return;
    const correct = sameSet(selected, correctIds);
    play(correct ? 'good' : 'again');
    setChecked(true);
    setAnswers((prev) => [...prev, { questionId: current.id, selected, correct }]);
  };

  const recordAttempt = async (finalAnswers: QuizAnswer[]) => {
    if (!currentUser || !quiz) return;
    try {
      await QuizService.recordAttempt(currentUser.id, {
        quizId: quiz.id,
        collectionId: quiz.collectionId,
        score: finalAnswers.filter((a) => a.correct).length,
        total: questions.length,
        answers: finalAnswers,
      });
    } catch (error) {
      console.error(error);
      toast({ title: t('quiz.session.saveError'), variant: 'destructive' });
    }
  };

  const handleNext = () => {
    if (index + 1 >= questions.length) {
      play('complete');
      setFinished(true);
      void recordAttempt(answers);
      return;
    }
    setIndex((i) => i + 1);
    setSelected([]);
    setChecked(false);
  };

  const handleRetry = () => {
    setIndex(0);
    setSelected([]);
    setChecked(false);
    setAnswers([]);
    setFinished(false);
  };

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (!quiz) return null;

  if (questions.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <p className="max-w-sm text-muted-foreground">{t('quiz.session.empty')}</p>
        <Button
          onClick={() => navigate(`/collection/${quiz.collectionId}`)}
          className="rounded-xl px-5"
        >
          {t('quiz.session.backToCollection')}
        </Button>
      </div>
    );
  }

  if (finished) {
    const passed =
      quiz.passThreshold == null ? true : (score / questions.length) * 100 >= quiz.passThreshold;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-warm/25 blur-2xl" />
          <div className="relative rounded-full bg-gradient-to-br from-warm/25 to-amber-400/10 p-8 ring-1 ring-warm/30">
            <Trophy className="h-16 w-16 text-warm drop-shadow-lg" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('quiz.session.resultTitle')}</h2>
          <p className="text-lg font-semibold tabular-nums">
            {t('quiz.session.score', { score, total: questions.length })}
          </p>
          <p className="text-muted-foreground">
            {passed ? t('quiz.session.passed') : t('quiz.session.failed')}
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={handleRetry} className="gap-2 rounded-xl px-5">
            <RotateCcw className="h-4 w-4" />
            {t('quiz.session.retry')}
          </Button>
          <Button
            onClick={() => navigate(`/collection/${quiz.collectionId}`)}
            className="rounded-xl px-5"
          >
            {t('quiz.session.backToCollection')}
          </Button>
        </div>
      </div>
    );
  }

  const progress = ((index + (checked ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(`/collection/${quiz.collectionId}`)}
          className="gap-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {t('quiz.session.questionProgress', { current: index + 1, total: questions.length })}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-warm to-amber-300 transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl sm:p-8">
        <h2 className="font-display text-xl font-bold leading-relaxed sm:text-2xl">
          {current.prompt}
        </h2>
        <div className="mt-6 space-y-3">
          {current.options.map((o) => {
            const isSel = selected.includes(o.id);
            const showCorrect = checked && o.correct;
            const showWrong = checked && isSel && !o.correct;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggleSelect(o.id)}
                disabled={checked}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition',
                  showCorrect &&
                    'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400',
                  showWrong && 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400',
                  !checked &&
                    (isSel
                      ? 'border-warm/60 bg-warm/10'
                      : 'border-border hover:border-warm/40 hover:bg-accent'),
                  checked && !showCorrect && !showWrong && 'border-border opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    isSel ? 'border-warm bg-warm text-white' : 'border-muted-foreground/40',
                  )}
                >
                  {showCorrect ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : showWrong ? (
                    <XCircle className="h-4 w-4" />
                  ) : null}
                </span>
                <span>{o.text}</span>
              </button>
            );
          })}
        </div>

        {checked && (
          <div
            className={clsx(
              'mt-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium',
              isCorrect
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400',
            )}
          >
            {isCorrect ? (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p>{isCorrect ? t('quiz.session.correct') : t('quiz.session.incorrect')}</p>
              {current.explanation && (
                <p className="mt-1 font-normal text-muted-foreground">{current.explanation}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        {!checked ? (
          <Button
            onClick={handleCheck}
            disabled={selected.length === 0}
            className="rounded-xl px-6"
          >
            {t('quiz.session.check')}
          </Button>
        ) : (
          <Button variant="warm" onClick={handleNext} className="rounded-xl px-6">
            {index + 1 >= questions.length ? t('quiz.session.finish') : t('quiz.session.next')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default QuizSession;

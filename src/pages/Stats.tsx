import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Target, Layers3, CalendarClock, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatsService, type RawStats } from '../services/StatsService';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { StatCard } from '../components/stats/StatCard';
import { ReviewsOverTimeChart } from '../components/stats/ReviewsOverTimeChart';
import { CategoryBreakdownChart } from '../components/stats/CategoryBreakdownChart';
import { NewVsReviewChart } from '../components/stats/NewVsReviewChart';
import { DueForecastChart } from '../components/stats/DueForecastChart';
import { StudyHeatmap } from '../components/stats/StudyHeatmap';
import { BestTimesChart } from '../components/stats/BestTimesChart';

const ALL = '__all__';

const Stats: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [raw, setRaw] = useState<RawStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>(ALL);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    (async () => {
      try {
        const data = await StatsService.getRawStats(currentUser.id);
        if (active) setRaw(data);
      } catch (error) {
        console.error(error);
        toast({ title: t('stats.loadError'), variant: 'destructive' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Categories present in the user's history, for the filter dropdown.
  const categories = useMemo(() => {
    if (!raw) return [];
    const set = new Set<string>();
    for (const log of raw.logs) if (log.deckCategory) set.add(log.deckCategory);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [raw]);

  const summary = useMemo(
    () => (raw ? StatsService.aggregate(raw, category === ALL ? null : category) : null),
    [raw, category],
  );

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (!summary) return null;

  const accuracyPct = Math.round(summary.accuracy * 100);
  const accuracy30Pct = Math.round(summary.accuracy30d * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            {t('stats.eyebrow')}
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {t('stats.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('stats.subtitle')}</p>
          {summary.hasData && summary.currentStreak > 0 && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-warm/40 bg-warm/10 px-3 py-1 text-xs font-semibold text-warm-foreground dark:text-warm">
              <Flame className="h-3.5 w-3.5 fill-current" aria-hidden />
              {t('stats.streakDays', { count: summary.currentStreak })}
            </span>
          )}
        </div>
        {categories.length > 0 && (
          <div className="w-full sm:w-56">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label={t('stats.filterAll')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('stats.filterAll')}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!summary.hasData ? (
        <Card className="bg-mesh border-dashed py-14 text-center">
          <CardHeader>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
              <BarChart3 className="h-7 w-7" />
            </span>
            <CardTitle className="font-display mt-2 text-2xl">{t('stats.empty')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('stats.emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              tone="warm"
              icon={<Flame className="h-5 w-5" />}
              label={t('stats.currentStreak')}
              value={t('stats.streakDays', { count: summary.currentStreak })}
              hint={t('stats.bestStreak', { count: summary.bestStreak })}
            />
            <StatCard
              icon={<Layers3 className="h-5 w-5" />}
              label={t('stats.reviews')}
              value={summary.totalReviews.toLocaleString()}
              hint={t('stats.activeDays', { count: summary.studyDays })}
            />
            <StatCard
              tone={accuracyPct >= 90 ? 'warm' : 'primary'}
              icon={<Target className="h-5 w-5" />}
              label={t('stats.accuracy')}
              value={`${accuracyPct}%`}
              hint={t('stats.accuracy30d', { value: accuracy30Pct })}
            />
            <StatCard
              icon={<CalendarClock className="h-5 w-5" />}
              label={t('stats.dueTitle')}
              value={summary.dueTotal.toLocaleString()}
              hint={t('stats.dueSoon')}
            />
          </div>

          <ReviewsOverTimeChart byDay={summary.byDay} />

          <div className="grid gap-6 lg:grid-cols-2">
            <CategoryBreakdownChart byCategory={summary.byCategory} />
            <NewVsReviewChart newCount={summary.newCount} reviewCount={summary.reviewCount} />
          </div>

          <DueForecastChart dueForecast={summary.dueForecast} />

          <StudyHeatmap byDay={summary.byDay} />

          <BestTimesChart byHour={summary.byHour} />
        </>
      )}
    </div>
  );
};

export default Stats;

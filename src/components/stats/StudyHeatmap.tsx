import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, format, startOfDay, startOfWeek, subWeeks } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import type { DayStat } from '../../services/StatsService';

const WEEKS = 12;

// Map a day's review count to one of 5 intensity levels.
const levelFor = (count: number, max: number): number => {
  if (count <= 0) return 0;
  if (max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
};

const LEVEL_ALPHA = [0, 0.35, 0.58, 0.8, 1];

export const StudyHeatmap: React.FC<{ byDay: DayStat[] }> = ({ byDay }) => {
  const { t, i18n } = useTranslation();

  const { columns, max, total, bestDay } = useMemo(() => {
    const map = new Map(byDay.map((d) => [d.date, d.total]));
    const today = startOfDay(new Date());
    const start = startOfWeek(subWeeks(today, WEEKS - 1), { weekStartsOn: 0 });
    let maxCount = 0;
    let sum = 0;
    let best: { date: string; count: number } | null = null;
    const cols: Array<Array<{ date: string; count: number; future: boolean }>> = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: Array<{ date: string; count: number; future: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d);
        const key = format(day, 'yyyy-MM-dd');
        const count = map.get(key) ?? 0;
        if (count > maxCount) maxCount = count;
        if (day <= today) {
          sum += count;
          if (!best || count > best.count) best = { date: key, count };
        }
        col.push({ date: key, count, future: day > today });
      }
      cols.push(col);
    }
    return { columns: cols, max: maxCount, total: sum, bestDay: best };
  }, [byDay]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stats.heatmap')}</CardTitle>
        <CardDescription>{t('stats.heatmapHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              {col.map((cell) => {
                const level = levelFor(cell.count, max);
                return (
                  <div
                    key={cell.date}
                    title={
                      cell.future
                        ? undefined
                        : `${new Date(cell.date).toLocaleDateString(i18n.language, {
                            day: 'numeric',
                            month: 'short',
                          })} · ${t('stats.reviewsCount', { count: cell.count })}`
                    }
                    className="h-4 w-4 rounded-[4px] border border-border/40 transition-transform duration-150 hover:scale-125 hover:ring-2 hover:ring-warm/40"
                    style={{
                      backgroundColor: cell.future
                        ? 'transparent'
                        : level === 0
                          ? 'hsl(var(--muted) / 0.35)'
                          : `hsl(var(--warm) / ${LEVEL_ALPHA[level]})`,
                      opacity: cell.future ? 0.3 : 1,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-warm/10 px-2.5 py-1 font-medium text-warm-foreground dark:text-warm">
              {t('stats.heatmapTotal', { count: total })}
            </span>
            {bestDay && bestDay.count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1 font-medium text-muted-foreground">
                {t('stats.heatmapBest', { count: bestDay.count })} ·{' '}
                {new Date(bestDay.date).toLocaleDateString(i18n.language, {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <span>{t('stats.less')}</span>
          {LEVEL_ALPHA.map((alpha, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-[3px] border border-border/40"
              style={{
                backgroundColor:
                  i === 0 ? 'hsl(var(--muted) / 0.35)' : `hsl(var(--warm) / ${alpha})`,
              }}
            />
          ))}
          <span>{t('stats.more')}</span>
        </div>
      </CardContent>
    </Card>
  );
};

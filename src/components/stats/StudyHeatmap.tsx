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

const LEVEL_ALPHA = [0, 0.25, 0.45, 0.7, 1];

export const StudyHeatmap: React.FC<{ byDay: DayStat[] }> = ({ byDay }) => {
  const { t, i18n } = useTranslation();

  const { columns, max } = useMemo(() => {
    const map = new Map(byDay.map((d) => [d.date, d.total]));
    const today = startOfDay(new Date());
    const start = startOfWeek(subWeeks(today, WEEKS - 1), { weekStartsOn: 0 });
    let maxCount = 0;
    const cols: Array<Array<{ date: string; count: number; future: boolean }>> = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: Array<{ date: string; count: number; future: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d);
        const key = format(day, 'yyyy-MM-dd');
        const count = map.get(key) ?? 0;
        if (count > maxCount) maxCount = count;
        col.push({ date: key, count, future: day > today });
      }
      cols.push(col);
    }
    return { columns: cols, max: maxCount };
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
                    className="h-3.5 w-3.5 rounded-[3px] border border-border/40"
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

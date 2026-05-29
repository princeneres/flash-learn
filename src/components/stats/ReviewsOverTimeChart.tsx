import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { addDays, format, startOfDay, subDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart';
import type { DayStat } from '../../services/StatsService';

const RANGE = 30;

export const ReviewsOverTimeChart: React.FC<{ byDay: DayStat[] }> = ({ byDay }) => {
  const { t, i18n } = useTranslation();

  const data = useMemo(() => {
    const map = new Map(byDay.map((d) => [d.date, d]));
    const start = subDays(startOfDay(new Date()), RANGE - 1);
    const out: Array<{ date: string; total: number; correct: number; label: string }> = [];
    for (let i = 0; i < RANGE; i++) {
      const d = addDays(start, i);
      const key = format(d, 'yyyy-MM-dd');
      const entry = map.get(key);
      out.push({
        date: key,
        total: entry?.total ?? 0,
        correct: entry?.correct ?? 0,
        label: format(d, 'd/M'),
      });
    }
    return out;
  }, [byDay]);

  const config = {
    total: { label: t('stats.reviewsLabel'), color: 'hsl(var(--chart-1))' },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stats.reviewsOverTime')}</CardTitle>
        <CardDescription>{t('stats.reviewsOverTimeHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/6] w-full">
          <BarChart data={data} margin={{ left: -20, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const raw = payload?.[0]?.payload?.date;
                    return raw
                      ? new Date(raw).toLocaleDateString(i18n.language, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })
                      : '';
                  }}
                />
              }
            />
            <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

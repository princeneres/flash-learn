import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart';
import type { HourStat } from '../../services/StatsService';

export const BestTimesChart: React.FC<{ byHour: HourStat[] }> = ({ byHour }) => {
  const { t } = useTranslation();

  const data = useMemo(
    () => byHour.map((h) => ({ hour: h.hour, count: h.count, label: `${h.hour}h` })),
    [byHour],
  );

  const config = {
    count: { label: t('stats.reviewsLabel'), color: 'hsl(var(--chart-4))' },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stats.bestTimes')}</CardTitle>
        <CardDescription>{t('stats.bestTimesHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/6] w-full">
          <BarChart data={data} margin={{ left: 0, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={2} />
            <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

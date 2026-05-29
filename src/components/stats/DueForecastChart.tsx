import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart';
import type { DueStat } from '../../services/StatsService';

export const DueForecastChart: React.FC<{ dueForecast: DueStat[] }> = ({ dueForecast }) => {
  const { t, i18n } = useTranslation();

  const data = useMemo(
    () =>
      dueForecast.map((d, i) => ({
        date: d.date,
        count: d.count,
        label: i === 0 ? t('stats.today') : format(parseISO(d.date), 'd/M'),
      })),
    [dueForecast, t],
  );

  const config = {
    count: { label: t('stats.dueLabel'), color: 'hsl(var(--chart-3))' },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stats.dueForecast')}</CardTitle>
        <CardDescription>{t('stats.dueForecastHint')}</CardDescription>
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
              minTickGap={16}
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
            <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

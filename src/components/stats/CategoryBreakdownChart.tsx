import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart';
import type { CategoryStat } from '../../services/StatsService';

const PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const CategoryBreakdownChart: React.FC<{ byCategory: CategoryStat[] }> = ({
  byCategory,
}) => {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      byCategory.slice(0, 8).map((c) => ({
        name: c.category || t('stats.uncategorized'),
        total: c.total,
      })),
    [byCategory, t],
  );

  const config = {
    total: { label: t('stats.reviewsLabel') },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('stats.byCategory')}</CardTitle>
          <CardDescription>{t('stats.byCategoryHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{t('stats.noReviews')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stats.byCategory')}</CardTitle>
        <CardDescription>{t('stats.byCategoryHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[4/3] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
          >
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={96}
              tickMargin={4}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Bar dataKey="total" radius={4}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

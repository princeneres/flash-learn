import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Pie, PieChart } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart';

export const NewVsReviewChart: React.FC<{ newCount: number; reviewCount: number }> = ({
  newCount,
  reviewCount,
}) => {
  const { t } = useTranslation();
  const total = newCount + reviewCount;

  const data = useMemo(
    () => [
      { key: 'newCards', value: newCount, fill: 'hsl(var(--chart-2))' },
      { key: 'reviewCards', value: reviewCount, fill: 'hsl(var(--chart-1))' },
    ],
    [newCount, reviewCount],
  );

  const config = {
    value: { label: t('stats.reviewsLabel') },
    newCards: { label: t('stats.newCards'), color: 'hsl(var(--chart-2))' },
    reviewCards: { label: t('stats.reviewCards'), color: 'hsl(var(--chart-1))' },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stats.newVsReview')}</CardTitle>
        <CardDescription>{t('stats.newVsReviewHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('stats.noReviews')}</p>
        ) : (
          <ChartContainer config={config} className="mx-auto aspect-square max-h-[220px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <Pie data={data} dataKey="value" nameKey="key" innerRadius={56} strokeWidth={4}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-2xl font-bold"
                          >
                            {total.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 20}
                            className="fill-muted-foreground text-xs"
                          >
                            {t('stats.reviewsLabel')}
                          </tspan>
                        </text>
                      );
                    }
                    return null;
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
        <div className="mt-3 flex items-center justify-center gap-6 text-sm">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ background: 'hsl(var(--chart-2))' }}
            />
            {t('stats.newCards')} · <span className="font-medium tabular-nums">{newCount}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ background: 'hsl(var(--chart-1))' }}
            />
            {t('stats.reviewCards')} ·{' '}
            <span className="font-medium tabular-nums">{reviewCount}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

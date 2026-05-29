import React from 'react';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** "warm" highlights reward-type stats (streak); "primary" is structural. */
  tone?: 'primary' | 'warm';
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  hint,
  tone = 'primary',
}) => (
  <Card className="overflow-hidden">
    <CardContent className="flex items-start gap-4 p-5">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          tone === 'warm' ? 'bg-warm/15 text-warm' : 'bg-primary/10 text-primary',
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums leading-tight">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </CardContent>
  </Card>
);

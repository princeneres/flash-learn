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
  <Card className="card-lift relative overflow-hidden hover:shadow-elegant">
    <span
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r to-transparent',
        tone === 'warm' ? 'from-warm/70' : 'from-primary/60',
      )}
      aria-hidden
    />
    <CardContent className="flex items-start gap-4 p-5">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-inner',
          tone === 'warm' ? 'bg-warm/15 text-warm' : 'bg-primary/10 text-primary',
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            'font-display mt-0.5 text-3xl font-extrabold tabular-nums leading-tight',
            tone === 'warm' && 'flame-text',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </CardContent>
  </Card>
);

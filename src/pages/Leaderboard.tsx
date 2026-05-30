import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Flame, Layers3, Crown } from 'lucide-react';
import { GamificationService, type LeaderboardEntry } from '../services/GamificationService';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { LoadingState } from '../components/LoadingState';
import { Card } from '../components/ui/card';

/** Deterministic, vivid fallback colour so each learner reads as distinct. */
const AVATAR_COLORS = [
  'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',
  'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  'bg-teal-500/15 text-teal-600 dark:text-teal-300',
];

const avatarColor = (name: string | null): string => {
  const key = name ?? '?';
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h << 5) - h + key.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

/** Shared avatar: the uploaded/OAuth photo, or the name's initial as a fallback. */
const Avatar: React.FC<{
  name: string | null;
  photoURL: string | null;
  className?: string;
}> = ({ name, photoURL, className }) => (
  <div
    className={clsx(
      'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-display font-bold',
      !photoURL && avatarColor(name),
      className,
    )}
  >
    {photoURL ? (
      <img src={photoURL} alt={name ?? ''} className="h-full w-full object-cover" />
    ) : (
      (name?.[0]?.toUpperCase() ?? '?')
    )}
  </div>
);

/** Small icon + number pair, echoing the StatCard language used on the Stats page. */
const MiniStat: React.FC<{
  icon: React.ReactNode;
  value: React.ReactNode;
  tone?: 'warm' | 'muted';
}> = ({ icon, value, tone = 'muted' }) => (
  <span
    className={clsx(
      'inline-flex items-center gap-1 text-sm tabular-nums',
      tone === 'warm' ? 'text-warm' : 'text-muted-foreground',
    )}
  >
    {icon}
    {value}
  </span>
);

const PODIUM_RING = ['ring-yellow-400', 'ring-slate-400', 'ring-amber-600'];
const PODIUM_TIER = ['tier-gold', 'tier-silver', 'tier-bronze'];
const PODIUM_GLOW = [
  'shadow-[0_12px_40px_-12px_hsl(45_96%_55%/0.6)]',
  'shadow-[0_12px_40px_-16px_hsl(220_14%_60%/0.5)]',
  'shadow-[0_12px_40px_-16px_hsl(28_70%_50%/0.5)]',
];
const PODIUM_MEDAL = ['🥇', '🥈', '🥉'];
const PODIUM_ORDER = [1, 0, 2]; // visually center the winner

const Leaderboard: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await GamificationService.getLeaderboard();
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState message={t('common.loading')} />;

  const podium = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 w-fit rounded-2xl border border-warm/30 bg-warm/10 p-4 shadow-[0_10px_40px_-12px_hsl(45_96%_55%/0.5)]">
          <Trophy className="h-12 w-12 text-warm" />
        </div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t('leaderboard.title')}
        </h1>
        <p className="text-muted-foreground">{t('leaderboard.subtitle')}</p>
      </div>

      {users.length === 0 ? (
        <Card className="bg-mesh border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">{t('leaderboard.empty')}</p>
        </Card>
      ) : (
        <>
          {/* Podium — top 3, winner centered and raised */}
          {podium.length > 0 && (
            <div className="flex items-end justify-center gap-3 sm:gap-6">
              {PODIUM_ORDER.filter((i) => i < podium.length).map((i) => {
                const user = podium[i];
                const isWinner = i === 0;
                return (
                  <div
                    key={user.id}
                    className={clsx(
                      'flex flex-1 animate-fade-up flex-col items-center gap-2',
                      isWinner ? 'max-w-[8rem]' : 'max-w-[7rem]',
                    )}
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    {isWinner && (
                      <Crown className="h-8 w-8 animate-float text-warm drop-shadow-[0_2px_8px_hsl(45_96%_55%/0.6)]" />
                    )}
                    <div className="relative">
                      <Avatar
                        name={user.displayName}
                        photoURL={user.photoURL}
                        className={clsx(
                          'ring-2 ring-offset-2 ring-offset-background',
                          PODIUM_RING[i],
                          isWinner ? 'h-20 w-20 text-2xl' : 'h-16 w-16 text-xl',
                          user.id === currentUser?.id && 'outline outline-2 outline-primary',
                        )}
                      />
                      <span className="absolute -bottom-1 -right-1 text-lg drop-shadow-sm">
                        {PODIUM_MEDAL[i]}
                      </span>
                    </div>
                    <p className="w-full truncate text-center text-sm font-semibold">
                      {user.displayName || t('leaderboard.anonymous')}
                    </p>
                    <div
                      className={clsx(
                        'flex w-full flex-col items-center rounded-2xl border border-border/50 px-2 py-3',
                        PODIUM_TIER[i],
                        PODIUM_GLOW[i],
                        isWinner ? 'pb-6' : 'pb-3',
                      )}
                    >
                      <span className="font-display text-2xl font-extrabold tabular-nums text-foreground">
                        {user.points || 0}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {t('leaderboard.points')}
                      </span>
                      <div className="mt-2 flex items-center gap-3">
                        <MiniStat
                          icon={<Flame className="h-3.5 w-3.5" />}
                          value={user.stats?.streak || 0}
                          tone="warm"
                        />
                        <MiniStat
                          icon={<Layers3 className="h-3.5 w-3.5" />}
                          value={user.stats?.totalReviews || 0}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Remaining ranks */}
          {rest.length > 0 && (
            <Card className="overflow-hidden border-border/50 bg-card/80">
              <div className="divide-y divide-border/60">
                {rest.map((user, index) => (
                  <div
                    key={user.id}
                    className={clsx(
                      'flex items-center gap-4 p-4 transition-colors hover:bg-muted/40',
                      user.id === currentUser?.id &&
                        'border-l-4 border-warm bg-gradient-to-r from-warm/10 to-transparent',
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/40 font-display text-sm font-bold tabular-nums text-muted-foreground">
                      {index + 4}
                    </div>
                    <Avatar
                      name={user.displayName}
                      photoURL={user.photoURL}
                      className="h-12 w-12 text-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold">
                        {user.displayName || t('leaderboard.anonymous')}
                        {user.id === currentUser?.id && (
                          <span className="ml-2 rounded-full bg-warm/15 px-2 py-0.5 text-xs font-medium text-warm-foreground dark:text-warm">
                            {t('leaderboard.you')}
                          </span>
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-4">
                        <MiniStat
                          icon={<Flame className="h-4 w-4" />}
                          value={t('leaderboard.streakDays', { count: user.stats?.streak || 0 })}
                          tone="warm"
                        />
                        <MiniStat
                          icon={<Layers3 className="h-4 w-4" />}
                          value={t('leaderboard.reviewCount', {
                            count: user.stats?.totalReviews || 0,
                          })}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-extrabold tabular-nums text-foreground">
                        {user.points || 0}
                      </p>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        {t('leaderboard.points')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Leaderboard;

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Flame, Layers3, Crown } from 'lucide-react';
import { GamificationService, type LeaderboardEntry } from '../services/GamificationService';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { LoadingState } from '../components/LoadingState';
import { Card } from '../components/ui/card';

/** Shared avatar: the uploaded/OAuth photo, or the name's initial as a fallback. */
const Avatar: React.FC<{
  name: string | null;
  photoURL: string | null;
  className?: string;
}> = ({ name, photoURL, className }) => (
  <div
    className={clsx(
      'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background font-semibold text-foreground',
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
        <div className="mx-auto mb-4 w-fit rounded-full border border-border/50 bg-background/80 p-4">
          <Trophy className="h-12 w-12 text-yellow-400" />
        </div>
        <h1 className="text-3xl font-bold">{t('leaderboard.title')}</h1>
        <p className="text-muted-foreground">{t('leaderboard.subtitle')}</p>
      </div>

      {users.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
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
                      'flex flex-1 flex-col items-center gap-2',
                      isWinner ? 'max-w-[8rem]' : 'max-w-[7rem]',
                    )}
                  >
                    {isWinner && <Crown className="h-6 w-6 text-yellow-400" />}
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
                    <p className="w-full truncate text-center text-sm font-semibold">
                      {user.displayName || t('leaderboard.anonymous')}
                    </p>
                    <div
                      className={clsx(
                        'flex w-full flex-col items-center rounded-2xl border border-border/50 bg-card/80 px-2 py-3',
                        isWinner ? 'pb-6' : 'pb-3',
                      )}
                    >
                      <span className="text-lg font-bold tabular-nums text-primary">
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
                      'flex items-center gap-4 p-4 transition hover:bg-muted/30',
                      user.id === currentUser?.id && 'border-l-4 border-primary bg-primary/5',
                    )}
                  >
                    <div className="w-8 text-center text-lg font-bold tabular-nums text-muted-foreground">
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
                          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
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
                      <p className="text-xl font-bold tabular-nums text-primary">
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

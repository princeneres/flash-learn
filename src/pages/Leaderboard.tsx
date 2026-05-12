import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trophy, Medal } from "lucide-react";
import { GamificationService } from "../services/GamificationService";
import { useAuth } from "../context/AuthContext";
import { clsx } from "clsx";
import { LoadingState } from "../components/LoadingState";
import { Card } from "../components/ui/card";

const Leaderboard: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 w-fit rounded-full border border-border/50 bg-background/80 p-4">
          <Trophy className="h-12 w-12 text-yellow-400" />
        </div>
        <h1 className="text-3xl font-bold">{t('leaderboard.title')}</h1>
        <p className="text-muted-foreground">{t('leaderboard.subtitle')}</p>
      </div>

      <Card className="overflow-hidden border-border/50 bg-card/80">
        <div className="divide-y divide-border/60">
          {users.map((user, index) => (
            <div
              key={user.id}
              className={clsx(
                "flex items-center gap-4 p-4 transition hover:bg-muted/30",
                user.id === currentUser?.id && "border-l-4 border-primary bg-primary/5"
              )}
            >
              <div className="w-12 text-center text-xl font-bold text-muted-foreground">
                {index + 1}
              </div>
              <div className="flex flex-1 items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-lg font-semibold">
                  {user.displayName?.[0] || '?'}
                </div>
                <div>
                  <p className="text-base font-semibold">
                    {user.displayName || t('leaderboard.anonymous')}
                    {index < 3 && <Medal className="ml-2 inline-block h-4 w-4 text-yellow-400" />}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('leaderboard.reviewCount', { count: user.stats?.totalReviews || 0 })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-primary">{user.points || 0}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('leaderboard.points')}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Leaderboard;

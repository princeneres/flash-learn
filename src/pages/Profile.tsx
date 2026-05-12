import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { User, Globe, Volume2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { LoadingState } from "../components/LoadingState";
import { useToast } from "../components/ui/use-toast";
import { AVAILABLE_LANGUAGES } from "../i18n";
import { Card, CardContent } from "../components/ui/card";

const Profile: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUser) {
      loadProfile();
    }
  }, [currentUser]);

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser!.id)
        .maybeSingle();
      if (data) {
        setUserData({
          displayName: data.display_name,
          email: data.email,
          points: data.points,
          stats: {
            totalReviews: data.total_reviews,
            streak: data.streak,
            lastStudyDate: data.last_study_date,
          },
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const changeLanguage = async (lang: string) => {
    i18n.changeLanguage(lang);
    try {
      await supabase
        .from('profiles')
        .update({ language: lang })
        .eq('id', currentUser!.id);
      toast({ title: t('profile.languageUpdated') });
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <LoadingState message={t('common.loading')} />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Card className="border-border/60 bg-card/90">
        <CardContent className="flex flex-col gap-8 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-4xl font-bold text-primary">
              {(userData?.displayName?.[0] as string | undefined) || <User className="h-12 w-12" />}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{t('auth.profile')}</p>
              <h1 className="text-3xl font-semibold">{userData?.displayName || (currentUser?.user_metadata?.full_name as string | undefined) || t('profile.fallbackName')}</h1>
              <p className="text-muted-foreground">{currentUser?.email}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('profile.points')}</p>
              <p className="mt-2 text-3xl font-bold text-blue-500">{userData?.points || 0}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('profile.reviews')}</p>
              <p className="mt-2 text-3xl font-bold text-green-500">{userData?.stats?.totalReviews || 0}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('profile.streak')}</p>
              <p className="mt-2 text-3xl font-bold text-yellow-500">{userData?.stats?.streak || 0}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('profile.settings')}</p>
              <h2 className="text-2xl font-semibold">{t('profile.personalization')}</h2>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/40 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 text-sm font-medium">
                <Globe className="h-5 w-5 text-muted-foreground" />
                {t('profile.languageLabel')}
              </div>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_LANGUAGES.map((lang) => (
                  <Button
                    key={lang.value}
                    size="sm"
                    variant={i18n.language === lang.value ? 'default' : 'outline'}
                    onClick={() => changeLanguage(lang.value)}
                  >
                    {lang.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/40 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 text-sm font-medium">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                {t('profile.soundLabel')}
              </div>
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('profile.soundSoon')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;

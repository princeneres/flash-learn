import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { neon } from '../lib/neon';
import {
  User,
  Globe,
  Volume2,
  Camera,
  Loader2,
  Sun,
  Moon,
  Check,
  Flame,
  Layers3,
  Trophy,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { LoadingState } from '../components/LoadingState';
import { useToast } from '../components/ui/use-toast';
import { AVAILABLE_LANGUAGES } from '../i18n';
import { Card, CardContent } from '../components/ui/card';
import { McpSettings } from '../components/McpSettings';
import { useTheme } from '../components/theme-provider';
import { useSound } from '../hooks/useSound';
import { AvatarService } from '../services/AvatarService';

interface ProfileData {
  displayName: string;
  email: string;
  photoURL: string | null;
  points: number;
  stats: { totalReviews: number; streak: number; lastStudyDate: string | null };
}

const Profile: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { enabled: soundEnabled, toggle: toggleSound } = useSound();
  const { toast } = useToast();
  const location = useLocation();

  const [userData, setUserData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const loadProfile = async () => {
    try {
      const { data } = await neon
        .from('profiles')
        .select('*')
        .eq('id', currentUser!.id)
        .maybeSingle();
      if (data) {
        const name = data.display_name || '';
        setUserData({
          displayName: name,
          email: data.email,
          photoURL: data.photo_url,
          points: data.points,
          stats: {
            totalReviews: data.total_reviews,
            streak: data.streak,
            lastStudyDate: data.last_study_date,
          },
        });
        setNameDraft(name);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to a section when reached via an anchor link (e.g. /profile#mcp from
  // the nav menu). Runs once data is loaded so the target element exists.
  useEffect(() => {
    if (loading || !location.hash) return;
    const el = document.querySelector(location.hash);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, location.hash]);

  const changeLanguage = async (lang: string) => {
    i18n.changeLanguage(lang);
    try {
      await neon.from('profiles').update({ language: lang }).eq('id', currentUser!.id);
      toast({ title: t('profile.languageUpdated') });
    } catch (error) {
      console.error(error);
    }
  };

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next || next === userData?.displayName) return;
    setSavingName(true);
    try {
      const { error } = await neon
        .from('profiles')
        .update({ display_name: next })
        .eq('id', currentUser!.id);
      if (error) throw error;
      setUserData((prev) => (prev ? { ...prev, displayName: next } : prev));
      toast({ title: t('profile.nameUpdated') });
    } catch (error) {
      console.error(error);
      toast({ title: t('profile.saveError'), variant: 'destructive' });
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-picking the same file
    if (!file || !currentUser) return;
    setUploadingAvatar(true);
    try {
      const url = await AvatarService.upload(currentUser.id, file);
      const { error } = await neon
        .from('profiles')
        .update({ photo_url: url })
        .eq('id', currentUser.id);
      if (error) throw error;
      setUserData((prev) => (prev ? { ...prev, photoURL: url } : prev));
      toast({ title: t('profile.avatarUpdated') });
    } catch (error) {
      console.error(error);
      toast({ title: t('profile.avatarError'), variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) return <LoadingState message={t('common.loading')} />;

  const initial = userData?.displayName?.[0]?.toUpperCase();
  const nameChanged = nameDraft.trim().length > 0 && nameDraft.trim() !== userData?.displayName;

  const points = userData?.points || 0;
  const reviews = userData?.stats?.totalReviews || 0;
  const streak = userData?.stats?.streak || 0;

  // Earned milestone badges — highest tier reached per metric, so the row stays tidy.
  const highest = (value: number, tiers: number[]) => tiers.filter((tier) => value >= tier).pop();
  const achievements = [
    { tier: highest(streak, [3, 7, 30, 100]), icon: Flame, label: t('profile.streak') },
    { tier: highest(reviews, [50, 100, 500, 1000]), icon: Layers3, label: t('profile.reviews') },
    { tier: highest(points, [100, 500, 1000, 5000]), icon: Trophy, label: t('profile.points') },
  ].filter((a): a is { tier: number; icon: typeof Flame; label: string } => a.tier !== undefined);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Card className="border-border/60 bg-card/90">
        <CardContent className="flex flex-col gap-8 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="font-display group relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 to-warm/15 text-4xl font-bold text-primary shadow-inner transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('profile.changeAvatar')}
            >
              {userData?.photoURL ? (
                <img
                  src={userData.photoURL}
                  alt={userData.displayName || t('profile.fallbackName')}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  {initial || <User className="h-12 w-12" />}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
                {uploadingAvatar ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Camera className="h-6 w-6" />
                )}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarPick}
            />
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                {t('auth.profile')}
              </p>
              <h1 className="font-display truncate text-4xl font-extrabold tracking-tight">
                {userData?.displayName || t('profile.fallbackName')}
              </h1>
              <p className="text-muted-foreground">{currentUser?.email}</p>
              {achievements.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {achievements.map((a) => (
                    <span
                      key={a.label}
                      className="inline-flex items-center gap-1 rounded-full border border-warm/40 bg-warm/10 px-2.5 py-1 text-xs font-semibold text-warm-foreground dark:text-warm"
                    >
                      <a.icon className="h-3.5 w-3.5" aria-hidden />
                      {a.tier}+ {a.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: t('profile.points'),
                value: points,
                icon: Trophy,
                tile: 'bg-primary/10 text-primary',
                accent: 'from-primary/60',
                flame: false,
              },
              {
                label: t('profile.reviews'),
                value: reviews,
                icon: Layers3,
                tile: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                accent: 'from-emerald-500/50',
                flame: false,
              },
              {
                label: t('profile.streak'),
                value: streak,
                icon: Flame,
                tile: 'bg-warm/15 text-warm',
                accent: 'from-warm/70',
                flame: true,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 p-5"
              >
                <span
                  className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r to-transparent',
                    s.accent,
                  )}
                  aria-hidden
                />
                <div
                  className={cn(
                    'mb-3 flex h-10 w-10 items-center justify-center rounded-xl shadow-inner',
                    s.tile,
                  )}
                >
                  <s.icon className="h-5 w-5" aria-hidden />
                </div>
                <p
                  className={cn(
                    'font-display text-4xl font-extrabold tabular-nums leading-none',
                    s.flame && 'flame-text',
                  )}
                >
                  {s.value.toLocaleString()}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {t('profile.settings')}
              </p>
              <h2 className="font-display text-2xl font-bold">{t('profile.personalization')}</h2>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
              <label htmlFor="displayName" className="flex items-center gap-3 text-sm font-medium">
                <User className="h-5 w-5 text-muted-foreground" />
                {t('profile.displayNameLabel')}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="displayName"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder={t('profile.fallbackName')}
                  maxLength={60}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                  }}
                />
                <Button onClick={saveName} disabled={!nameChanged || savingName} className="gap-2">
                  {savingName ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {t('common.save')}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/40 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 text-sm font-medium">
                {theme === 'dark' ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                {t('profile.themeLabel')}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={theme === 'light' ? 'default' : 'outline'}
                  onClick={() => setTheme('light')}
                  className="gap-2"
                >
                  <Sun className="h-4 w-4" />
                  {t('profile.themeLight')}
                </Button>
                <Button
                  size="sm"
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  onClick={() => setTheme('dark')}
                  className="gap-2"
                >
                  <Moon className="h-4 w-4" />
                  {t('profile.themeDark')}
                </Button>
              </div>
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
              <Switch
                checked={soundEnabled}
                onCheckedChange={toggleSound}
                aria-label={t('profile.soundLabel')}
              />
            </div>

            <McpSettings />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { User, Globe, Volume2, HardDrive, Cloud, FolderOpen, FolderSync } from "lucide-react";
import { UserSettingsService, type MediaBackend } from "../services/UserSettingsService";
import { LocalDirectoryService } from "../services/LocalDirectoryService";
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

  const [mediaBackend, setMediaBackend] = useState<MediaBackend>('local');
  const [savingBackend, setSavingBackend] = useState(false);

  const [dirSupported] = useState<boolean>(LocalDirectoryService.isSupported());
  const [dirName, setDirName] = useState<string | null>(null);
  const [dirPermission, setDirPermission] = useState<'none' | 'granted' | 'prompt' | 'denied'>('none');
  const [pickingDir, setPickingDir] = useState(false);

  const refreshDir = async () => {
    const [name, perm] = await Promise.all([
      LocalDirectoryService.getName(),
      LocalDirectoryService.getPermissionState(),
    ]);
    setDirName(name);
    setDirPermission(perm);
  };

  useEffect(() => {
    refreshDir();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    UserSettingsService.getMediaBackend(currentUser.uid)
      .then(setMediaBackend)
      .catch(() => setMediaBackend('local'));
  }, [currentUser]);

  const handleChangeBackend = async (next: MediaBackend) => {
    if (!currentUser || next === mediaBackend) return;
    if (next === 'cloud') {
      toast({ title: t('profile.mediaStorageCloudSoon') });
      return;
    }
    setSavingBackend(true);
    try {
      await UserSettingsService.setMediaBackend(currentUser.uid, next);
      setMediaBackend(next);
      toast({ title: t('profile.mediaStorageUpdated') });
    } catch (error) {
      console.error(error);
      toast({ title: t('profile.mediaStorageError'), variant: 'destructive' });
    } finally {
      setSavingBackend(false);
    }
  };

  const handlePickDirectory = async () => {
    if (!dirSupported) return;
    setPickingDir(true);
    try {
      const handle = await LocalDirectoryService.pick();
      if (handle) {
        await refreshDir();
        toast({ title: t('profile.directoryPicked', { name: handle.name }) });
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error(error);
        toast({ title: t('profile.directoryError'), variant: 'destructive' });
      }
    } finally {
      setPickingDir(false);
    }
  };

  const handleReconnectDirectory = async () => {
    const ok = await LocalDirectoryService.reconnect();
    await refreshDir();
    if (!ok) {
      toast({ title: t('profile.directoryReconnectError'), variant: 'destructive' });
    }
  };

  const handleClearDirectory = async () => {
    await LocalDirectoryService.clear();
    await refreshDir();
    toast({ title: t('profile.directoryCleared') });
  };

  useEffect(() => {
    if (currentUser) {
      loadProfile();
    }
  }, [currentUser]);

  const loadProfile = async () => {
    try {
      const docRef = doc(db, 'users', currentUser!.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data());
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
      const docRef = doc(db, 'users', currentUser!.uid);
      await updateDoc(docRef, {
        'settings.language': lang
      });
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
              {currentUser?.displayName?.[0] || <User className="h-12 w-12" />}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{t('auth.profile')}</p>
              <h1 className="text-3xl font-semibold">{currentUser?.displayName || t('profile.fallbackName')}</h1>
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

            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 text-sm font-medium">
                  {mediaBackend === 'cloud' ? (
                    <Cloud className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p>{t('profile.mediaStorageLabel')}</p>
                    <p className="text-xs font-normal text-muted-foreground">
                      {t('profile.mediaStorageDescription')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mediaBackend === 'local' ? 'default' : 'outline'}
                  onClick={() => handleChangeBackend('local')}
                  disabled={savingBackend}
                >
                  <HardDrive className="h-4 w-4 mr-2" />
                  {t('profile.mediaStorageLocal')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  title={t('profile.mediaStorageCloudSoon')}
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  {t('profile.mediaStorageCloud')}
                  <span className="ml-2 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                    {t('profile.comingSoonBadge')}
                  </span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('profile.mediaStorageCloudSoon')}
              </p>

              {mediaBackend === 'local' && (
                <div className="mt-2 space-y-2 rounded-xl border border-border/40 bg-background/60 p-3">
                  <div className="flex items-start gap-3">
                    <FolderOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t('profile.directoryLabel')}</p>
                      <p className="text-xs text-muted-foreground">
                        {dirSupported
                          ? t('profile.directoryDescription')
                          : t('profile.directoryUnsupported')}
                      </p>
                      {dirName && (
                        <p className="mt-2 text-xs">
                          <span className="font-medium">{t('profile.directoryCurrent')}:</span>{' '}
                          <code className="rounded bg-muted/60 px-1.5 py-0.5">{dirName}</code>
                          {dirPermission !== 'granted' && (
                            <span className="ml-2 rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 text-[10px] uppercase">
                              {t('profile.directoryPermissionNeeded')}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  {dirSupported && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePickDirectory}
                        disabled={pickingDir}
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        {dirName ? t('profile.directoryChange') : t('profile.directoryChoose')}
                      </Button>
                      {dirName && dirPermission !== 'granted' && (
                        <Button size="sm" variant="outline" onClick={handleReconnectDirectory}>
                          <FolderSync className="h-4 w-4 mr-2" />
                          {t('profile.directoryReconnect')}
                        </Button>
                      )}
                      {dirName && (
                        <Button size="sm" variant="ghost" onClick={handleClearDirectory}>
                          {t('profile.directoryClear')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;

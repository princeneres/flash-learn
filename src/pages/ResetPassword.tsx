import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LockKeyhole } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useResetPassword } from '../hooks/useResetPassword';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/use-toast';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const { t } = useTranslation();
  const { resetPassword, loading } = useResetPassword();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  // The recovery link signs the user in with a temporary session
  // (detectSessionInUrl). Confirm it exists before allowing a reset.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: t('auth.passwordsDoNotMatch'), variant: 'destructive' });
      return;
    }
    await resetPassword(password);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,_rgba(251,191,36,0.18),_transparent_55%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12">
        <Card className="w-full border-border/60 bg-card/95 shadow-2xl">
          <CardHeader className="space-y-2 text-center py-4">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-warm/15 text-warm shadow-inner">
              <LockKeyhole className="h-6 w-6" />
            </span>
            <CardTitle className="font-display text-3xl font-extrabold">
              {t('auth.resetPassword')}
            </CardTitle>
            <CardDescription>
              {ready ? t('auth.resetPasswordSubtitle') : t('auth.resetLinkInvalid')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ready ? (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.newPassword')}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t('auth.confirmPassword')}</Label>
                  <Input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <Button type="submit" variant="warm" disabled={loading} className="w-full">
                  {loading ? t('common.loading') : t('auth.updatePassword')}
                </Button>
              </form>
            ) : (
              <div className="text-center text-sm">
                <Link
                  to="/forgot-password"
                  className="font-semibold text-primary transition hover:text-primary/80"
                >
                  {t('auth.requestNewLink')}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <footer className="relative z-10 px-4 pb-8 text-center text-sm text-muted-foreground">
        <p>© {currentYear} Flash Learn.</p>
      </footer>
    </div>
  );
};

export default ResetPassword;

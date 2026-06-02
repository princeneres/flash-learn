import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LockKeyhole, MailCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useForgotPassword } from '../hooks/useForgotPassword';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const { t } = useTranslation();
  const { sendResetEmail, loading, sent } = useForgotPassword();
  const currentYear = new Date().getFullYear();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetEmail(email);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,_rgba(251,191,36,0.18),_transparent_55%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12">
        <Card className="w-full border-border/60 bg-card/95 shadow-2xl">
          <CardHeader className="space-y-2 text-center py-4">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-warm/15 text-warm shadow-inner">
              {sent ? <MailCheck className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
            </span>
            <CardTitle className="font-display text-3xl font-extrabold">
              {t('auth.forgotPassword')}
            </CardTitle>
            <CardDescription>
              {sent ? t('auth.resetEmailSentDescription') : t('auth.forgotPasswordSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-6 text-center">
                <p className="text-sm text-muted-foreground">{email}</p>
                <Link to="/login">
                  <Button variant="warm" className="w-full">
                    {t('auth.backToLogin')}
                  </Button>
                </Link>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email-address">{t('auth.email')}</Label>
                  <Input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <Button type="submit" variant="warm" disabled={loading} className="w-full">
                  {loading ? t('common.loading') : t('auth.sendResetLink')}
                </Button>

                <div className="text-center text-sm">
                  <Link
                    to="/login"
                    className="font-semibold text-primary transition hover:text-primary/80"
                  >
                    {t('auth.backToLogin')}
                  </Link>
                </div>
              </form>
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

export default ForgotPassword;

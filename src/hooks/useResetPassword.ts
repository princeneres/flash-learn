import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { betterAuth } from '../lib/neon';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ui/use-toast';

export const useResetPassword = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  // `token` comes from the reset link (Neon Auth redirects to /reset-password?token=…).
  const resetPassword = async (password: string, token: string) => {
    setLoading(true);
    try {
      const { error } = await betterAuth.resetPassword({ newPassword: password, token });
      if (error) throw new Error(error.message);
      toast({ title: t('auth.passwordUpdated') });
      navigate('/login');
    } catch (error) {
      console.error(error);
      toast({
        title: t('auth.passwordUpdateFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return { resetPassword, loading };
};

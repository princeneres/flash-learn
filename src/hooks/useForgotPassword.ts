import { useState } from 'react';
import { neon } from '../lib/neon';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ui/use-toast';

export const useForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();

  const sendResetEmail = async (email: string) => {
    setLoading(true);
    try {
      const { error } = await neon.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast({ title: t('auth.resetEmailSent') });
    } catch (error) {
      console.error(error);
      toast({
        title: t('auth.resetEmailFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return { sendResetEmail, loading, sent };
};

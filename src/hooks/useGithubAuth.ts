import { useState } from "react";
import { neon } from "../lib/neon";
import { useToast } from "../components/ui/use-toast";
import { useTranslation } from "react-i18next";

export const useGithubAuth = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const loginWithGithub = async () => {
    setLoading(true);
    try {
      const { error } = await neon.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error(error);
      const description = error instanceof Error ? error.message : undefined;
      toast({
        title: t("auth.loginFailed"),
        description,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return { loginWithGithub, loading };
};

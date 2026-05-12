import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../components/ui/use-toast";
import { useTranslation } from "react-i18next";

export const useGoogleAuth = () => {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { t } = useTranslation();

    const loginWithGoogle = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                    queryParams: { prompt: "select_account" },
                },
            });
            if (error) throw error;
            // OAuth redirects away; no manual navigation here.
        } catch (error) {
            console.error(error);
            const description =
                error instanceof Error ? error.message : undefined;
            toast({
                title: t("auth.loginFailed"),
                description,
                variant: "destructive",
            });
            setLoading(false);
        }
    };

    return { loginWithGoogle, loading };
};

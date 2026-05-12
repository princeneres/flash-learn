import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useTranslation } from "react-i18next";
import { useToast } from "../components/ui/use-toast";

export const useLogin = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { toast } = useToast();

    const login = async (email: string, password: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            toast({ title: t("auth.welcomeBack") });
            navigate("/dashboard");
        } catch (error: any) {
            console.error(error);
            toast({
                title: t("auth.loginFailed"),
                description: error?.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return { login, loading };
};

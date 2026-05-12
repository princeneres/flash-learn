import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useTranslation } from "react-i18next";
import { useToast } from "../components/ui/use-toast";

export const useSignup = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { toast } = useToast();

    const signup = async (name: string, email: string, password: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name },
                },
            });
            if (error) throw error;
            // Ensure profile row reflects the chosen display name + language.
            const user = data.user;
            if (user) {
                await supabase
                    .from("profiles")
                    .update({ display_name: name, language: i18n.language })
                    .eq("id", user.id);
            }
            toast({ title: t("auth.accountCreated") });
            navigate("/dashboard");
        } catch (error: any) {
            console.error(error);
            toast({
                title: t("auth.signupFailed"),
                description: error?.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return { signup, loading };
};

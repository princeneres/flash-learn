import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
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
            await signInWithEmailAndPassword(auth, email, password);
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

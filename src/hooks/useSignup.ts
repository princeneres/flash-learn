import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useTranslation } from "react-i18next";
import { useToast } from "../components/ui/use-toast";

export const useSignup = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { toast } = useToast();

    const signup = async (name: string, email: string, password: string) => {
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );
            const user = userCredential.user;

            await updateProfile(user, {
                displayName: name,
            });

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                displayName: name,
                email: email,
                stats: {
                    totalReviews: 0,
                    streak: 0,
                    lastStudyDate: null,
                },
                points: 0,
                settings: {
                    language: "en",
                    soundEnabled: true,
                },
                createdAt: new Date().toISOString(),
            });

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

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ui/use-toast";
import { useTranslation } from "react-i18next";
import { auth, db } from "../lib/firebase";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export const useGoogleAuth = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t, i18n } = useTranslation();

    const loginWithGoogle = async () => {
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const userRef = doc(db, "users", user.uid);
            const snap = await getDoc(userRef);

            if (!snap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    displayName: user.displayName || "",
                    email: user.email,
                    photoURL: user.photoURL,
                    stats: {
                        totalReviews: 0,
                        streak: 0,
                        lastStudyDate: null,
                    },
                    points: 0,
                    settings: {
                        language: i18n.language,
                        soundEnabled: true,
                    },
                    createdAt: new Date().toISOString(),
                    provider: "google",
                });
            }

            toast({ title: t("auth.welcomeBack") });
            navigate("/dashboard");
        } catch (error) {
            console.error(error);
            const description =
                error instanceof Error ? error.message : undefined;
            toast({
                title: t("auth.loginFailed"),
                description,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return { loginWithGoogle, loading };
};

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Github, LockKeyhole, Sparkles, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useLogin } from "../hooks/useLogin";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { useGithubAuth } from "../hooks/useGithubAuth";
import { useGoogleAuth } from "../hooks/useGoogleAuth";

const Login: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { t } = useTranslation();
    const { login, loading } = useLogin();
    const { loginWithGithub, loading: githubLoading } = useGithubAuth();
    const { loginWithGoogle, loading: googleLoading } = useGoogleAuth();
    const currentYear = new Date().getFullYear();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await login(email, password);
    };

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_60%)]" />
            <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-12 lg:grid-cols-2">
                <div className="space-y-8 text-center lg:text-left">
                    <div className="flex flex-col text-center items-center gap-2 rounded-full px-4 py-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        {t("auth.heroSubtitle")}
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-semibold leading-tight text-pretty lg:text-5xl">
                            {t("auth.heroTitle")}
                        </h1>
                        <p className="text-base text-muted-foreground lg:text-lg">
                            {t("auth.loginSubtitle")}
                        </p>
                    </div>
                    <div className="grid gap-4 text-left sm:grid-cols-2">
                        {[
                            { icon: Users, label: t("auth.featureCommunity") },
                            {
                                icon: LockKeyhole,
                                label: t("auth.featurePrivacy"),
                            },
                        ].map(({ icon: Icon, label }) => (
                            <div
                                key={label}
                                className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm"
                            >
                                <Icon className="h-5 w-5 text-primary" />
                                <p className="mt-3 text-sm text-muted-foreground">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <Card className="border-border/60 bg-card/95 shadow-2xl">
                    <CardHeader className="space-y-2 text-center py-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                            {t("auth.welcomeBack")}
                        </p>
                        <CardTitle className="text-3xl">
                            {t("auth.login")}
                        </CardTitle>
                        <CardDescription>
                            {t("auth.loginSubtitle")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full gap-2"
                                    onClick={loginWithGoogle}
                                    disabled={googleLoading}
                                >
                                    <svg
                                        className="h-4 w-4"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            fill="#4285F4"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    {googleLoading
                                        ? t("common.loading")
                                        : t("auth.googleCta")}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full gap-2"
                                    onClick={loginWithGithub}
                                    disabled={githubLoading}
                                >
                                    <Github className="h-4 w-4" />
                                    {githubLoading
                                        ? t("common.loading")
                                        : t("auth.githubCta")}
                                </Button>
                            </div>
                            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                                <span className="h-px flex-1 bg-border" />
                                {t("auth.orContinue")}
                                <span className="h-px flex-1 bg-border" />
                            </div>
                        </div>
                        <form
                            className="mt-6 space-y-6"
                            onSubmit={handleSubmit}
                        >
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email-address">
                                        {t("auth.email")}
                                    </Label>
                                    <Input
                                        id="email-address"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">
                                        {t("auth.password")}
                                    </Label>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full"
                            >
                                {loading
                                    ? t("common.loading")
                                    : t("auth.login")}
                            </Button>

                            <div className="text-center text-sm">
                                <span className="text-muted-foreground">
                                    {t("auth.dontHaveAccount")}
                                </span>
                                <Link
                                    to="/signup"
                                    className="font-semibold text-primary transition hover:text-primary/80"
                                >
                                    {t("auth.signup")}
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
            <footer className="relative z-10 px-4 pb-8 text-center text-sm text-muted-foreground">
                <p>
                    © {currentYear} Flash Learn. Built by{" "}
                    <a
                        href="https://github.com/princeneres"
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                        Prince Neres
                    </a>
                    .
                </p>
            </footer>
        </div>
    );
};

export default Login;

import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowRight,
    Brain,
    Check,
    Globe2,
    Layers,
    LockKeyhole,
    Play,
    Quote,
    Sparkles,
    Star,
    Target,
    Trophy,
    Users,
    Zap,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { ThemeToggle } from "../components/ThemeToggle";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

const useReveal = () => {
    const ref = useRef<HTMLElement | null>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    obs.disconnect();
                }
            },
            { threshold: 0.15 }
        );
        obs.observe(node);
        return () => obs.disconnect();
    }, []);
    return { ref, visible };
};

const Reveal: React.FC<{
    children: React.ReactNode;
    delay?: number;
    className?: string;
}> = ({ children, delay = 0, className = "" }) => {
    const { ref, visible } = useReveal();
    return (
        <div
            ref={ref as React.RefObject<HTMLDivElement>}
            style={{ animationDelay: `${delay}ms` }}
            className={`${
                visible ? "animate-fade-up" : "opacity-0"
            } ${className}`}
        >
            {children}
        </div>
    );
};

const Landing: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [flipped, setFlipped] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const currentYear = new Date().getFullYear();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const goLogin = () => navigate("/login");

    const features = [
        {
            icon: Brain,
            title: t("landing.feat1Title"),
            body: t("landing.feat1Body"),
            tone: "from-blue-500/20 to-cyan-500/20",
        },
        {
            icon: Users,
            title: t("landing.feat2Title"),
            body: t("landing.feat2Body"),
            tone: "from-violet-500/20 to-fuchsia-500/20",
        },
        {
            icon: Trophy,
            title: t("landing.feat3Title"),
            body: t("landing.feat3Body"),
            tone: "from-amber-500/20 to-rose-500/20",
        },
        {
            icon: Target,
            title: t("landing.feat4Title"),
            body: t("landing.feat4Body"),
            tone: "from-emerald-500/20 to-teal-500/20",
        },
        {
            icon: LockKeyhole,
            title: t("landing.feat5Title"),
            body: t("landing.feat5Body"),
            tone: "from-slate-500/20 to-blue-500/20",
        },
        {
            icon: Globe2,
            title: t("landing.feat6Title"),
            body: t("landing.feat6Body"),
            tone: "from-pink-500/20 to-orange-500/20",
        },
    ];

    const metrics = [
        {
            label: t("landing.metric1Label"),
            value: t("landing.metric1Value"),
            icon: Layers,
        },
        {
            label: t("landing.metric2Label"),
            value: t("landing.metric2Value"),
            icon: Users,
        },
        {
            label: t("landing.metric3Label"),
            value: t("landing.metric3Value"),
            icon: Brain,
        },
        {
            label: t("landing.metric4Label"),
            value: t("landing.metric4Value"),
            icon: Star,
        },
    ];

    const steps = [
        {
            title: t("landing.step1Title"),
            body: t("landing.step1Body"),
            icon: Layers,
        },
        {
            title: t("landing.step2Title"),
            body: t("landing.step2Body"),
            icon: Brain,
        },
        {
            title: t("landing.step3Title"),
            body: t("landing.step3Body"),
            icon: Trophy,
        },
    ];

    const testimonials = [
        {
            text: t("landing.testimonial1"),
            name: t("landing.testimonial1Name"),
            role: t("landing.testimonial1Role"),
        },
        {
            text: t("landing.testimonial2"),
            name: t("landing.testimonial2Name"),
            role: t("landing.testimonial2Role"),
        },
        {
            text: t("landing.testimonial3"),
            name: t("landing.testimonial3Name"),
            role: t("landing.testimonial3Role"),
        },
    ];

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
            <div className="pointer-events-none fixed inset-0 -z-10 bg-mesh" />
            <div className="pointer-events-none fixed inset-0 -z-10 grid-pattern opacity-70" />
            <div
                aria-hidden
                className="pointer-events-none fixed -top-40 -left-40 -z-10 h-[420px] w-[420px] rounded-full bg-blue-500/30 blur-3xl animate-float-slow"
            />
            <div
                aria-hidden
                className="pointer-events-none fixed -bottom-40 -right-40 -z-10 h-[480px] w-[480px] rounded-full bg-fuchsia-500/25 blur-3xl animate-float-slow"
                style={{ animationDelay: "3s" }}
            />

            <header
                className={`sticky top-0 z-50 transition-all duration-300 ${
                    scrolled
                        ? "border-b border-border/60 bg-background/80 backdrop-blur-xl shadow-sm"
                        : "border-b border-transparent"
                }`}
            >
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
                    <Link to="/" className="flex items-center gap-2">
                        <img
                            src="/logo.png"
                            alt="Flash Learn"
                            className="h-8 w-8 transition-transform hover:rotate-12"
                        />
                        <span className="text-base font-semibold tracking-tight">
                            Flash Learn
                        </span>
                    </Link>
                    <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex">
                        <a
                            href="#features"
                            className="rounded-full px-3 py-1.5 transition hover:bg-accent hover:text-accent-foreground"
                        >
                            {t("landing.navFeatures")}
                        </a>
                        <a
                            href="#how"
                            className="rounded-full px-3 py-1.5 transition hover:bg-accent hover:text-accent-foreground"
                        >
                            {t("landing.navHow")}
                        </a>
                        <a
                            href="#testimonials"
                            className="rounded-full px-3 py-1.5 transition hover:bg-accent hover:text-accent-foreground"
                        >
                            {t("landing.navTestimonials")}
                        </a>
                    </nav>
                    <div className="flex items-center gap-2">
                        <div className="hidden md:block">
                            <LanguageSwitcher />
                        </div>
                        <ThemeToggle />
                        <Button
                            onClick={goLogin}
                            size="sm"
                            className="group relative gap-1.5 overflow-hidden"
                        >
                            <span className="relative z-10">
                                {t("landing.signIn")}
                            </span>
                            <ArrowRight className="relative z-10 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                    </div>
                </div>
            </header>

            <section className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-12 sm:pt-20">
                <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="text-center lg:text-left">
                        <Reveal>
                            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                                </span>
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                {t("landing.badge")}
                            </span>
                        </Reveal>

                        <Reveal delay={120}>
                            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                                <span className="block">
                                    {t("landing.heroTitleA")}
                                </span>
                                <span className="block text-gradient-primary animate-gradient-x">
                                    {t("landing.heroTitleB")}
                                </span>
                            </h1>
                        </Reveal>

                        <Reveal delay={220}>
                            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0">
                                {t("landing.heroSubtitle")}
                            </p>
                        </Reveal>

                        <Reveal delay={320}>
                            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:items-start lg:justify-start">
                                <Button
                                    onClick={goLogin}
                                    size="lg"
                                    className="group relative h-12 w-full overflow-hidden px-8 text-base font-semibold shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 sm:w-auto"
                                >
                                    <span
                                        aria-hidden
                                        className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.35)_50%,transparent_70%)] bg-[length:200%_100%] animate-shimmer"
                                    />
                                    <span className="relative z-10 flex items-center gap-2">
                                        {t("landing.ctaPrimary")}
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </span>
                                </Button>
                                <Button
                                    asChild
                                    variant="outline"
                                    size="lg"
                                    className="h-12 w-full gap-2 px-6 text-base sm:w-auto"
                                >
                                    <a href="#how">
                                        <Play className="h-4 w-4" />
                                        {t("landing.ctaSecondary")}
                                    </a>
                                </Button>
                            </div>
                        </Reveal>

                        <Reveal delay={420}>
                            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                                {[
                                    t("landing.trust1"),
                                    t("landing.trust2"),
                                    t("landing.trust3"),
                                ].map((item) => (
                                    <li
                                        key={item}
                                        className="flex items-center gap-1.5"
                                    >
                                        <Check className="h-4 w-4 text-primary" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </Reveal>
                    </div>

                    <Reveal delay={200} className="flex justify-center">
                        <div className="relative">
                            <div
                                aria-hidden
                                className="absolute -inset-8 -z-10 rounded-full bg-gradient-to-br from-primary/30 via-fuchsia-500/20 to-cyan-500/20 blur-3xl animate-float"
                            />

                            <div className="perspective-1000">
                                <button
                                    type="button"
                                    onClick={() => setFlipped((v) => !v)}
                                    aria-label={t("landing.demoHint")}
                                    className="group relative h-72 w-72 cursor-pointer transition-transform duration-700 transform-style-3d sm:h-80 sm:w-80 hover:scale-[1.03]"
                                    style={{
                                        transform: flipped
                                            ? "rotateY(180deg)"
                                            : "rotateY(0deg)",
                                        transformStyle: "preserve-3d",
                                    }}
                                >
                                    <div
                                        className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/90 p-8 text-center shadow-2xl backface-hidden card-shadow"
                                        style={{ backfaceVisibility: "hidden" }}
                                    >
                                        <Sparkles className="mb-4 h-8 w-8 text-primary" />
                                        <p className="text-xl font-semibold leading-snug">
                                            {t("landing.demoFront")}
                                        </p>
                                        <span className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                                            {t("landing.demoHint")}
                                        </span>
                                    </div>
                                    <div
                                        className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/90 to-fuchsia-600/90 p-8 text-center text-primary-foreground shadow-2xl rotate-y-180 backface-hidden"
                                        style={{
                                            backfaceVisibility: "hidden",
                                            transform: "rotateY(180deg)",
                                        }}
                                    >
                                        <Trophy className="mb-4 h-8 w-8" />
                                        <p className="text-3xl font-bold leading-tight">
                                            {t("landing.demoBack")}
                                        </p>
                                        <span className="mt-6 text-xs uppercase tracking-[0.3em] opacity-80">
                                            +10 XP
                                        </span>
                                    </div>
                                </button>
                            </div>

                            <div
                                aria-hidden
                                className="absolute -right-6 -top-6 hidden animate-float rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-xl backdrop-blur sm:block"
                                style={{ animationDelay: "1.5s" }}
                            >
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-amber-500" />
                                    <div>
                                        <p className="text-xs font-semibold">
                                            +24 XP
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Streak 14d
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div
                                aria-hidden
                                className="absolute -bottom-4 -left-8 hidden animate-float rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-xl backdrop-blur sm:block"
                                style={{ animationDelay: "0.8s" }}
                            >
                                <div className="flex items-center gap-2">
                                    <Brain className="h-4 w-4 text-violet-500" />
                                    <div>
                                        <p className="text-xs font-semibold">
                                            94% retention
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Adaptive AI
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>

                <Reveal delay={500}>
                    <div className="mt-20 grid grid-cols-2 gap-3 rounded-3xl border border-border/60 bg-card/50 p-4 backdrop-blur md:grid-cols-4 md:gap-6 md:p-6">
                        {metrics.map(({ icon: Icon, label, value }) => (
                            <div
                                key={label}
                                className="group relative flex flex-col items-center gap-1 rounded-2xl px-4 py-3 text-center transition hover:bg-accent/40"
                            >
                                <Icon className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                                <p className="text-2xl font-bold tracking-tight md:text-3xl">
                                    {value}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>
                </Reveal>
            </section>

            <section
                id="features"
                className="relative mx-auto w-full max-w-6xl px-4 py-24"
            >
                <Reveal>
                    <div className="text-center">
                        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                            {t("landing.navFeatures")}
                        </span>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                            {t("landing.featuresTitle")}
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
                            {t("landing.featuresSubtitle")}
                        </p>
                    </div>
                </Reveal>

                <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map(({ icon: Icon, title, body, tone }, i) => (
                        <Reveal key={title} delay={i * 80}>
                            <div className="group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
                                <div
                                    aria-hidden
                                    className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${tone} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
                                />
                                <div className="relative">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110 group-hover:rotate-3">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mt-5 text-lg font-semibold">
                                        {title}
                                    </h3>
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                        {body}
                                    </p>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            <section
                id="how"
                className="relative mx-auto w-full max-w-6xl px-4 py-24"
            >
                <Reveal>
                    <div className="text-center">
                        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                            {t("landing.navHow")}
                        </span>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                            {t("landing.howTitle")}
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
                            {t("landing.howSubtitle")}
                        </p>
                    </div>
                </Reveal>

                <div className="relative mt-14 grid gap-6 md:grid-cols-3">
                    <div
                        aria-hidden
                        className="absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block"
                    />
                    {steps.map(({ title, body, icon: Icon }, i) => (
                        <Reveal key={title} delay={i * 120}>
                            <div className="group relative h-full rounded-3xl border border-border/60 bg-card/70 p-6 text-center backdrop-blur transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl">
                                <div className="relative mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-600 text-primary-foreground shadow-lg shadow-primary/30 transition-transform group-hover:scale-110">
                                    <Icon className="h-6 w-6" />
                                    <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background text-xs font-bold text-primary">
                                        {i + 1}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-lg font-semibold">
                                    {title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    {body}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            <section
                id="testimonials"
                className="relative mx-auto w-full max-w-6xl px-4 py-24"
            >
                <Reveal>
                    <div className="text-center">
                        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                            {t("landing.navTestimonials")}
                        </span>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                            {t("landing.testimonialsTitle")}
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
                            {t("landing.testimonialsSubtitle")}
                        </p>
                    </div>
                </Reveal>

                <div className="mt-14 grid gap-6 md:grid-cols-3">
                    {testimonials.map(({ text, name, role }, i) => (
                        <Reveal key={name} delay={i * 100}>
                            <figure className="group relative h-full overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
                                <Quote className="h-8 w-8 text-primary/30 transition-colors group-hover:text-primary/60" />
                                <blockquote className="mt-3 text-sm leading-relaxed text-foreground">
                                    {text}
                                </blockquote>
                                <figcaption className="mt-6 flex items-center gap-3 border-t border-border/40 pt-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-600 text-sm font-bold text-primary-foreground">
                                        {name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {role}
                                        </p>
                                    </div>
                                    <div className="ml-auto flex gap-0.5 text-amber-400">
                                        {[...Array(5)].map((_, j) => (
                                            <Star
                                                key={j}
                                                className="h-3.5 w-3.5 fill-current"
                                            />
                                        ))}
                                    </div>
                                </figcaption>
                            </figure>
                        </Reveal>
                    ))}
                </div>
            </section>

            <section className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-8">
                <Reveal>
                    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary via-violet-600 to-fuchsia-600 p-10 text-center text-primary-foreground shadow-2xl shadow-primary/30 sm:p-14">
                        <div
                            aria-hidden
                            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.18),transparent_50%)]"
                        />
                        <div
                            aria-hidden
                            className="absolute -top-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-white/20 blur-3xl animate-float"
                        />
                        <div className="relative">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] backdrop-blur">
                                <Sparkles className="h-3.5 w-3.5" />
                                {t("landing.finalCtaEyebrow")}
                            </span>
                            <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                                {t("landing.finalCtaTitle")}
                            </h2>
                            <p className="mx-auto mt-4 max-w-2xl text-base opacity-90 sm:text-lg">
                                {t("landing.finalCtaSubtitle")}
                            </p>
                            <div className="mt-8 flex justify-center">
                                <Button
                                    onClick={goLogin}
                                    size="lg"
                                    variant="secondary"
                                    className="group h-12 gap-2 bg-white px-8 text-base font-semibold text-primary shadow-xl hover:bg-white/95 hover:scale-[1.02] transition-transform"
                                >
                                    {t("landing.finalCtaButton")}
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            <footer className="border-t border-border/60 bg-background/60 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
                    <div className="flex items-center gap-2">
                        <img
                            src="/logo.png"
                            alt="Flash Learn"
                            className="h-6 w-6"
                        />
                        <span className="font-medium text-foreground">
                            Flash Learn
                        </span>
                        <span className="hidden sm:inline">
                            {t("landing.footerTagline")}
                        </span>
                    </div>
                    <p className="text-center sm:text-right">
                        © {currentYear} Flash Learn ·{" "}
                        {t("landing.footerRights")} ·{" "}
                        <a
                            href="https://github.com/prince-neres"
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                            Prince Neres
                        </a>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;

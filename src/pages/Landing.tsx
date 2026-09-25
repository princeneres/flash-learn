import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Brain,
  Check,
  Flame,
  GraduationCap,
  KeyRound,
  Languages,
  LineChart,
  Pencil,
  Repeat,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Users,
  Wand2,
  WifiOff,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

// AI deck generation is paused (its buttons are hidden on the dashboard), so
// the landing page must not advertise it either.
const AI_DECKS_ENABLED = false;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
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
}> = ({ children, delay = 0, className = '' }) => {
  const { ref, visible } = useReveal();
  const reduced = useMemo(() => prefersReducedMotion(), []);

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      style={{ animationDelay: `${delay}ms` }}
      className={`${visible ? 'animate-fade-up' : 'opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
};

/* ── Brand wordmark ──────────────────────────────────────────────── */
const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`flex items-center gap-2.5 ${className}`}>
    <img src="/logo.png" alt="" aria-hidden className="h-7 w-7 rounded-[7px] shadow-sm" />
    <span translate="no" className="text-[15px] font-semibold tracking-tight text-foreground">
      Flash Learn
    </span>
  </span>
);

/* ── Hero product mockup: a realistic study session window ───────── */
const StudyMockup: React.FC = () => {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  const ratings = [
    { key: 'demoAgain', cls: 'text-rose-300 ring-rose-400/30 hover:bg-rose-400/10' },
    { key: 'demoHard', cls: 'text-amber-300 ring-amber-400/30 hover:bg-amber-400/10' },
    { key: 'demoGood', cls: 'text-emerald-300 ring-emerald-400/30 hover:bg-emerald-400/10' },
    { key: 'demoEasy', cls: 'text-sky-300 ring-sky-400/30 hover:bg-sky-400/10' },
  ];

  return (
    <div className="relative w-full max-w-md">
      {/* soft brand halo behind the window */}
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 text-slate-100 shadow-elegant">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          </span>
          <span className="ml-1 truncate text-xs font-medium text-slate-400">
            {t('landing.demoDeck')}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-400/20">
            <Flame className="h-3 w-3" />
            {t('landing.demoStreak')}
          </span>
        </div>

        {/* body */}
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t('landing.demoProgress')}</span>
            <span className="tabular-nums">30%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70"
            role="progressbar"
            aria-valuenow={30}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full w-[30%] rounded-full bg-primary" />
          </div>

          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            className="group flex min-h-[9.5rem] w-full flex-col items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/50 px-5 py-6 text-center transition-colors hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <span className="text-[15px] font-medium leading-snug text-slate-100">
              {t('landing.demoFront')}
            </span>
            <span
              className={`mt-3 text-2xl font-semibold tracking-tight text-primary transition-all duration-300 ${
                revealed ? 'opacity-100' : 'select-none opacity-0 blur-sm'
              }`}
            >
              {t('landing.demoBack')}
            </span>
            {!revealed && (
              <span className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {t('landing.demoHint')}
              </span>
            )}
          </button>

          <div
            className={`grid grid-cols-4 gap-2 transition-opacity duration-300 ${
              revealed ? 'opacity-100' : 'pointer-events-none opacity-40'
            }`}
          >
            {ratings.map(({ key, cls }) => (
              <span
                key={key}
                className={`rounded-lg py-2 text-center text-xs font-medium ring-1 ring-inset transition-colors ${cls}`}
              >
                {t(`landing.${key}`)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── AI section mockup: the deck generator ──────────────────────── */
const AiMockup: React.FC = () => {
  const { t } = useTranslation();
  const cards = [
    { f: t('landing.aiMockCard1Front'), b: t('landing.aiMockCard1Back') },
    { f: t('landing.aiMockCard2Front'), b: t('landing.aiMockCard2Back') },
  ];
  return (
    <div className="relative w-full max-w-md">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 text-slate-100 shadow-elegant">
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-slate-300">{t('landing.aiTitleShort')}</span>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {t('landing.aiMockTopic')}
            </span>
            <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-200">
              {t('landing.aiMockTopicValue')}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {[t('landing.aiMockCount'), t('landing.aiMockLevel'), t('landing.aiMockLang')].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-slate-800 px-2.5 py-1 font-medium text-slate-300 ring-1 ring-inset ring-slate-700"
                >
                  {chip}
                </span>
              ),
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground">
              <Wand2 className="h-3 w-3" />
              {t('landing.aiMockGenerate')}
            </span>
          </div>
          <div className="space-y-2 border-t border-slate-700/60 pt-3">
            {cards.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">{c.f}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <span className="font-medium text-primary">{c.b}</span>
                <Check className="ml-auto h-4 w-4 shrink-0 text-emerald-400" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Landing: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      // reveal once the user has scrolled past one full viewport
      setShowTop(y > window.innerHeight);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(1, y / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const goLogin = () => navigate('/login');

  const scrollToTop = () =>
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });

  const capabilities = [
    { icon: Brain, value: t('landing.cap1Value'), label: t('landing.cap1Label') },
    { icon: WifiOff, value: t('landing.cap2Value'), label: t('landing.cap2Label') },
    { icon: Languages, value: t('landing.cap3Value'), label: t('landing.cap3Label') },
    { icon: BadgeCheck, value: t('landing.cap4Value'), label: t('landing.cap4Label') },
  ];

  const features = [
    { icon: Repeat, title: t('landing.feat1Title'), body: t('landing.feat1Body') },
    { icon: Users, title: t('landing.feat2Title'), body: t('landing.feat2Body') },
    { icon: Flame, title: t('landing.feat3Title'), body: t('landing.feat3Body') },
    { icon: Brain, title: t('landing.feat4Title'), body: t('landing.feat4Body') },
    { icon: ShieldCheck, title: t('landing.feat5Title'), body: t('landing.feat5Body') },
    { icon: Smartphone, title: t('landing.feat6Title'), body: t('landing.feat6Body') },
  ];

  const steps = [
    { title: t('landing.step1Title'), body: t('landing.step1Body') },
    { title: t('landing.step2Title'), body: t('landing.step2Body') },
    { title: t('landing.step3Title'), body: t('landing.step3Body') },
  ];

  const aiPoints = [
    { icon: Wand2, title: t('landing.aiPoint1Title'), body: t('landing.aiPoint1Body') },
    { icon: Pencil, title: t('landing.aiPoint2Title'), body: t('landing.aiPoint2Body') },
    { icon: KeyRound, title: t('landing.aiPoint3Title'), body: t('landing.aiPoint3Body') },
  ];

  const useCases = [
    { icon: Languages, title: t('landing.useCase1Title'), body: t('landing.useCase1Body') },
    { icon: Stethoscope, title: t('landing.useCase2Title'), body: t('landing.useCase2Body') },
    { icon: GraduationCap, title: t('landing.useCase3Title'), body: t('landing.useCase3Body') },
    { icon: LineChart, title: t('landing.useCase4Title'), body: t('landing.useCase4Body') },
  ];

  const navLinks = [
    { href: '#features', label: t('landing.navFeatures') },
    { href: '#how', label: t('landing.navHow') },
    ...(AI_DECKS_ENABLED ? [{ href: '#ai', label: t('landing.navAi') }] : []),
    { href: '#use-cases', label: t('landing.navUseCases') },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-mesh" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-pattern" />

      {/* ── Header ───────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-border/60 bg-background/80 shadow-sm backdrop-blur-xl'
            : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <ThemeToggle />
            <Button onClick={goLogin} size="sm" className="group gap-1.5">
              {t('landing.signIn')}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div className="text-center lg:text-left">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-warm/40 bg-warm/10 px-3.5 py-1.5 text-xs font-medium text-warm-foreground backdrop-blur dark:text-warm">
                <Sparkles className="h-3.5 w-3.5 text-warm" />
                {t('landing.badge')}
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="font-display mt-6 text-balance text-[2.75rem] font-extrabold leading-[1.04] tracking-[-0.02em] sm:text-6xl">
                {t('landing.heroTitleA')}
                <br />
                <span className="text-primary">{t('landing.heroTitleB')}</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                {t('landing.heroSubtitle')}
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-3 lg:justify-start">
                <Button
                  onClick={goLogin}
                  size="lg"
                  variant="warm"
                  className="group h-12 w-full gap-2 px-7 text-base font-semibold shadow-lg shadow-warm/30 transition-all hover:shadow-xl hover:shadow-warm/40 sm:w-auto"
                >
                  {t('landing.ctaPrimary')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 w-full px-6 text-base sm:w-auto"
                >
                  <a href="#how">{t('landing.ctaSecondary')}</a>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                {[t('landing.trust1'), t('landing.trust2'), t('landing.trust3')].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={160} className="flex justify-center lg:justify-end">
            <StudyMockup />
          </Reveal>
        </div>

        {/* honest capability strip — replaces fabricated metrics */}
        <Reveal delay={360}>
          <dl className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-4">
            {capabilities.map(({ icon: Icon, value, label }, i) => (
              <div key={label} className="flex flex-col gap-1.5 bg-card/70 p-5 backdrop-blur">
                <Icon className={i % 2 === 1 ? 'h-5 w-5 text-warm' : 'h-5 w-5 text-primary'} />
                <dt className="font-display text-xl font-bold tracking-tight">{value}</dt>
                <dd className="text-sm text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('landing.featuresEyebrow')}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {t('landing.featuresTitle')}
          </h2>
          <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
            {t('landing.featuresSubtitle')}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={(i % 3) * 70}>
              <div className="group h-full rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-warm/40 hover:shadow-elegant">
                <div
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105',
                    i % 2 === 1 ? 'bg-warm/15 text-warm' : 'bg-primary/10 text-primary',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section id="how" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('landing.howEyebrow')}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {t('landing.howTitle')}
          </h2>
          <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
            {t('landing.howSubtitle')}
          </p>
        </Reveal>

        <div className="relative mt-14 grid gap-4 md:grid-cols-3">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          {steps.map(({ title, body }, i) => (
            <Reveal key={title} delay={i * 90}>
              <div className="relative h-full rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur">
                <span className="font-display inline-flex h-9 w-9 items-center justify-center rounded-full bg-warm text-sm font-bold text-warm-foreground shadow-sm shadow-warm/30">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {AI_DECKS_ENABLED && (
        <>
          {/* ── AI deck generation (honest) ──────────────────────── */}
          <section id="ai" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <Reveal>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {t('landing.aiEyebrow')}
                </p>
                <h2 className="font-display mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {t('landing.aiTitle')}
                </h2>
                <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {t('landing.aiSubtitle')}
                </p>

                <ul className="mt-8 space-y-5">
                  {aiPoints.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex gap-4">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="mt-7 rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
                  {t('landing.aiNote')}
                </p>
              </Reveal>

              <Reveal delay={120} className="flex justify-center lg:justify-end">
                <AiMockup />
              </Reveal>
            </div>
          </section>
        </>
      )}

      {/* ── Use cases (replaces fabricated testimonials) ─────── */}
      <section id="use-cases" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('landing.useCasesEyebrow')}
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {t('landing.useCasesTitle')}
          </h2>
          <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
            {t('landing.useCasesSubtitle')}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={(i % 4) * 70}>
              <div className="group h-full rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-warm/40 hover:shadow-elegant">
                <Icon
                  className={cn(
                    'h-6 w-6 transition-transform duration-300 group-hover:scale-105',
                    i % 2 === 1 ? 'text-warm' : 'text-primary',
                  )}
                />
                <h3 className="mt-5 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-primary px-6 py-14 text-center text-primary-foreground shadow-elegant sm:px-14 sm:py-16">
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                backgroundSize: '44px 44px',
                maskImage: 'radial-gradient(ellipse 70% 80% at 50% 0%, black, transparent 75%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse 70% 80% at 50% 0%, black, transparent 75%)',
              }}
            />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
                {t('landing.finalCtaEyebrow')}
              </p>
              <h2 className="font-display mx-auto mt-4 max-w-2xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                {t('landing.finalCtaTitle')}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-primary-foreground/80 sm:text-lg">
                {t('landing.finalCtaSubtitle')}
              </p>
              <div className="mt-8 flex justify-center">
                <Button
                  onClick={goLogin}
                  size="lg"
                  variant="secondary"
                  className="group h-12 gap-2 bg-background px-7 text-base font-semibold text-foreground shadow-lg transition-transform hover:scale-[1.02] hover:bg-background/95"
                >
                  {t('landing.finalCtaButton')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
            <Wordmark />
            <span className="hidden text-muted-foreground sm:inline">
              · {t('landing.footerTagline')}
            </span>
          </div>
          <div className="flex flex-col items-center gap-3 sm:items-end">
            <nav className="flex items-center gap-4">
              <Link
                to="/privacy"
                className="font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t('landing.footerPrivacy')}
              </Link>
              <Link
                to="/terms"
                className="font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t('landing.footerTerms')}
              </Link>
            </nav>
            <p className="text-center sm:text-right">
              © {currentYear} <span translate="no">Flash Learn</span> · {t('landing.footerRights')}{' '}
              ·{' '}
              <a
                href="https://github.com/princeneres"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Prince Neres
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* ── Back-to-top button ───────────────────────────────── */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label={t('landing.backToTop')}
        title={t('landing.backToTop')}
        className={cn(
          'group fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full sm:bottom-8 sm:right-8',
          'transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          showTop
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-6 scale-75 opacity-0',
        )}
      >
        {/* animated glow halo */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-warm/40 blur-xl transition-opacity duration-500 group-hover:bg-warm/60"
        />
        {/* pulse ring on hover */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full ring-2 ring-warm/50 opacity-0 transition-opacity duration-300 group-hover:animate-pulse-ring group-hover:opacity-100"
        />

        {/* scroll progress ring */}
        <svg aria-hidden viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="24" cy="24" r="21" className="fill-none stroke-warm/20" strokeWidth="2.5" />
          <circle
            cx="24"
            cy="24"
            r="21"
            className="fill-none stroke-warm transition-[stroke-dashoffset] duration-150 ease-out"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 21}
            strokeDashoffset={2 * Math.PI * 21 * (1 - scrollProgress)}
          />
        </svg>

        {/* solid core */}
        <span
          className={cn(
            'relative grid h-11 w-11 place-items-center rounded-full',
            'bg-gradient-to-br from-warm to-warm/80 text-warm-foreground shadow-lg shadow-warm/40',
            'transition-transform duration-300 group-hover:scale-105 group-active:scale-95',
          )}
        >
          <ArrowUp
            className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5"
            strokeWidth={2.5}
          />
        </span>
      </button>
    </div>
  );
};

export default Landing;

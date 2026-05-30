import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/* Brand wordmark — mirrors the Landing header so legal pages feel native. */
const Wordmark: React.FC = () => (
  <span className="flex items-center gap-2.5">
    <img src="/logo.png" alt="" aria-hidden className="h-7 w-7 rounded-[7px] shadow-sm" />
    <span translate="no" className="text-[15px] font-semibold tracking-tight text-foreground">
      Flash Learn
    </span>
  </span>
);

export interface LegalSection {
  heading: string;
  /** Each entry is a paragraph; arrays render as bullet lists. */
  body: Array<string | string[]>;
}

interface LegalLayoutProps {
  title: string;
  updatedLabel: string;
  backLabel: string;
  sections: LegalSection[];
}

/**
 * Shared shell for the public Privacy Policy and Terms of Service pages.
 * These pages are intentionally reachable without authentication — Google's
 * OAuth verification requires the privacy policy to be visible to anyone.
 */
const LegalLayout: React.FC<LegalLayoutProps> = ({ title, updatedLabel, backLabel, sections }) => {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · Flash Learn`;
    return () => {
      document.title = prev;
    };
  }, [title]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-mesh" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-pattern" />

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Wordmark />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{updatedLabel}</p>

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{section.heading}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {section.body.map((block, i) =>
                  Array.isArray(block) ? (
                    <ul key={i} className="list-disc space-y-1.5 pl-5">
                      {block.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i}>{block}</p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-4">
            <Link
              to="/privacy"
              className="hover:text-foreground hover:underline underline-offset-4"
            >
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground hover:underline underline-offset-4">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default LegalLayout;

<div align="center">

<img src="public/logo.png" alt="Flash Learn logo" width="112" />

# Flash Learn

**Spaced-repetition flashcards with rich cards, collections, quizzes and community decks.**

Flash Learn turns what you want to learn into flashcards and schedules each review just before you would forget it.
Web app, installable as a PWA, in English and Brazilian Portuguese.

[![Live app](https://img.shields.io/badge/app-flashlearn.princeneres.dev-F5B301)](https://flashlearn.princeneres.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[Live app](https://flashlearn.princeneres.dev) ·
[Features](#features) ·
[Screenshots](#screenshots) ·
[Self-hosting](#getting-started) ·
[MCP server](mcp-server/README.md)

<img src="docs/screenshots/study.gif" alt="Study session: reveal the answer, rate it, and move to the next card" width="860" />

</div>

## Features

**Study**

- **Spaced repetition.** An SM-2-based scheduler with Anki-style learning and relearning steps. Every deck can
  tune its own steps, interval cap and daily new-card limit.
- **Four-button grading** (Again, Hard, Good, Easy), with the next interval shown on each button.
- **Cloze deletions** (`{{c1::answer}}`) and **type-the-answer** cards for active recall.
- **Rich cards.** TipTap editor with headings, lists, code blocks, links, images, audio and KaTeX math.
- **Keyboard and touch friendly.** <kbd>Space</kbd> reveals, <kbd>1</kbd>–<kbd>4</kbd> grade, and the session
  layout fits phone screens.

**Organize**

- **Collections** group related decks and hold **quizzes** with single-choice, multiple-choice and true/false
  questions, explanations and a pass threshold.
- **Public decks.** Publish a deck, browse and favorite decks from other learners, or copy one into your account.
- **Import and export** decks, media included, as portable `.fldeck.zip` bundles.
- **MCP server.** Create decks, collections and quizzes from Claude or any MCP client. See
  [`mcp-server/`](mcp-server/README.md).

**Stay consistent**

- **Statistics:** reviews over time, study heatmap, accuracy, due forecast, new vs. review, best study hours and a
  category breakdown.
- **Gamification:** points, daily streaks, achievements and a leaderboard. Scores are computed server-side so
  they can't be forged from the browser.
- **Installable PWA** with offline support, **light and dark themes**, sound effects and **English / Portuguese**
  translations.

**Accounts**

- Email and password, Google and GitHub sign-in, and password reset by email.
- Every table is protected by Postgres Row Level Security. Plan quotas are enforced by database triggers.

## Screenshots

| Dashboard                                                                              | Study session                                                    |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| ![Deck dashboard with favorites and category filters](docs/screenshots/dashboard.png)  | ![Study card with the answer hidden](docs/screenshots/study.png) |
| **Statistics**                                                                         | **Leaderboard**                                                  |
| ![Statistics page with streak, accuracy and review charts](docs/screenshots/stats.png) | ![Leaderboard podium](docs/screenshots/leaderboard.png)          |
| **Collection with decks and a quiz**                                                   | **Quiz**                                                         |
| ![Collection detail](docs/screenshots/collection.png)                                  | ![Multiple-choice quiz question](docs/screenshots/quiz.png)      |
| **Public decks**                                                                       | **Deck editor**                                                  |
| ![Community decks](docs/screenshots/public.png)                                        | ![Deck detail with card list](docs/screenshots/deck.png)         |

<details>
<summary><strong>Dark mode, mobile and landing page</strong></summary>

| Dark dashboard                                                 | Dark statistics                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| ![Dashboard in dark mode](docs/screenshots/dashboard-dark.png) | ![Statistics in dark mode](docs/screenshots/stats-dark.png) |

<p>
  <img src="docs/screenshots/m-dashboard.png" alt="Mobile dashboard" width="260" />
  <img src="docs/screenshots/m-study.png" alt="Mobile study card" width="260" />
  <img src="docs/screenshots/m-study-answer.png" alt="Mobile study card with grading buttons" width="260" />
</p>

![Landing page](docs/screenshots/landing.png)

</details>

> The screenshots use fictional demo accounts and data.

## Tech stack

| Layer    | Tools                                                             |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 19, Vite 7, TypeScript 5, React Router 7                    |
| UI       | Tailwind CSS, Radix UI primitives, lucide-react, Recharts         |
| Editor   | TipTap 3, KaTeX, DOMPurify                                        |
| Backend  | Supabase: Auth, Postgres with RLS, Storage, Edge Functions (Deno) |
| i18n     | i18next, react-i18next                                            |
| PWA      | vite-plugin-pwa, Workbox                                          |
| Hosting  | Vercel (static SPA)                                               |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 20+ and [pnpm](https://pnpm.io) 10+
- A [Supabase](https://supabase.com) project (the free tier is enough)
- The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), to apply migrations and
  deploy edge functions
- Optional: [Docker](https://www.docker.com), to run the whole backend locally with `supabase start`

### 1. Install

```bash
git clone https://github.com/princeneres/flash-learn.git
cd flash-learn
pnpm install
```

### 2. Create the database

Link the CLI to your project and apply every migration in `supabase/migrations/`:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or run everything locally instead: `supabase start` applies the migrations to a local stack and prints the local
URL and keys.

Deck and card quotas come from the `plans` table. The migrations seed a `free` plan (10 decks, 100 cards per deck,
1,000 cards in total) and a `pro` plan; tune the limits there.

### 3. Configure the app

Copy `.env.example` to `.env` and fill in the project URL and anon key from **Project Settings → API**:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

In the Supabase dashboard:

1. **Storage:** nothing to do. The migrations create the private `media` bucket and scope it to each user's
   folder.
2. **Authentication → URL Configuration:** set the Site URL to `http://localhost:5173` and add
   `http://localhost:5173/**` to the redirect URLs (plus your production URL when you deploy).
3. **Authentication → Providers:** enable Google and GitHub if you want social sign-in.

### 4. Run

```bash
pnpm dev          # http://localhost:5173
pnpm build        # type-check and production build
pnpm preview      # serve the production build
pnpm lint         # ESLint
pnpm format       # Prettier
```

### Optional: edge functions

The core app needs only the database. The edge functions in `supabase/functions/` power optional features and read
their configuration from Supabase secrets (`supabase secrets set KEY=value`):

| Function                                                | Feature                                                         | Secrets                                                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `feature-suggestion`                                    | In-app suggestion form, delivered by email                      | `RESEND_API_KEY`, `SUGGESTIONS_TO_EMAIL`, `SUGGESTIONS_FROM_EMAIL`                                          |
| `ai-generate`                                           | AI deck generation with per-use credits (UI currently disabled) | `OPENAI_API_KEY`, `OPENAI_MODEL`                                                                            |
| `buy-credits`, `create-subscription`, `abacate-webhook` | Billing through AbacatePay (UI currently disabled)              | `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET`, `ABACATEPAY_SIGNING_KEY`, `ABACATE_PRODUCT_*`, `APP_URL` |

Deploy them with `supabase functions deploy`.

## Security model

- **Row Level Security everywhere.** Users can read and write only their own rows. Decks and collections marked
  public are readable by any signed-in user.
- **Server-side rules.** Points, streaks and achievements are awarded by a `SECURITY DEFINER` function, and
  direct writes to those profile fields are blocked by a trigger. Plan quotas are enforced by triggers, so they
  also apply to the MCP server and any other API client.
- **Private media.** Card images and audio live in a private `media` bucket, scoped to `<user-id>/…` paths and
  served through signed URLs.
- **Sanitized content.** Card HTML is sanitized with DOMPurify before rendering.
- Service-role keys and third-party API keys are used only inside edge functions, never in the browser.

## Project structure

```
src/
  pages/            Route views: Landing, Dashboard, DeckDetail, StudySession, Collections,
                    QuizSession, Stats, Leaderboard, PublicDecks, Profile, auth and legal pages
  components/       Card editor, rich content renderer, dialogs, stats charts, ui/ primitives
  services/         Data access and domain logic (decks, cards, collections, quizzes, stats,
                    media storage, import/export, SRS scheduler in srsAlgorithm.ts)
  hooks/            Auth flows, plan limits, PWA install prompt, sounds
  i18n/locales/     en.json and pt.json
  types/database.ts Types generated from the Supabase schema (pnpm db:types)
supabase/
  migrations/       Schema, RLS policies, triggers and RPCs
  functions/        Edge functions (suggestions, AI generation, billing)
mcp-server/         MCP server for creating content from AI assistants
docs/               Design notes and screenshots
```

## Roadmap

- [x] Collections and quizzes
- [x] Per-deck spaced-repetition settings and daily new-card limits
- [x] MCP server with browser login
- [ ] Re-enable AI deck generation
- [ ] Anki (`.apkg`) import
- [ ] Deck ratings and comments
- [ ] Swipe gestures in mobile study mode

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and report vulnerabilities privately as
described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

## Acknowledgements

- [Anki](https://apps.ankiweb.net), for the scheduling ideas Flash Learn builds on
- [TipTap](https://tiptap.dev), [Radix UI](https://www.radix-ui.com) and [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com), for auth, Postgres and storage

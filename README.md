<div align="center">

<img src="public/logo.png" alt="Flash Learn logo" width="140" />

# Flash Learn

**An open-source, Anki-inspired flashcard app with spaced repetition, rich-content cards, and community decks.**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-2-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

</div>

---

## ✨ About

Flash Learn is a modern, web-based flashcard platform designed for serious learners. It combines the proven **SM-2 spaced repetition algorithm** with a polished UI, rich-content cards (images, audio, links, formatting), Anki interoperability, and a gamification layer to keep daily review streaks alive.

The project is fully open source and built with a TypeScript-first, accessibility-aware stack. Self-host it, fork it, or contribute back.

## 🚀 Features

- 🎯 **Adaptive spaced repetition** — SM-2 algorithm schedules each card at the moment you're about to forget it.
- 📝 **Rich-content cards** — TipTap WYSIWYG editor with headings, lists, quotes, code blocks, links, images, and inline audio.
- 🔁 **Anki interoperability** — Import `.apkg`, `.colpkg`, `.csv`, `.tsv`, or `.txt` files (including images, audio, cloze deletions, and HTML formatting).
- 📦 **Deck export** — Export a single deck or all of your decks to a portable `.fldeck.zip` bundle with embedded media.
- 🗂️ **Choose where media lives** — Save card images and audio inside your browser (IndexedDB) or pick a real folder on your computer via the File System Access API.
- 👥 **Community decks** — Publish decks publicly and discover what others are studying.
- 🏆 **Gamification** — Daily streaks, achievements, leaderboards, and a points system.
- 🌍 **Internationalized** — Full English and Portuguese (BR) translations, easy to extend.
- 🌗 **Light and dark themes** out of the box.
- 📱 **PWA-ready** — Installable, with an offline-first service worker.
- 🔐 **Authentication** — Firebase Auth with email/password, Google, and GitHub providers.

## 🛠️ Tech Stack

| Layer | Tools |
|-------|-------|
| **Framework** | React 19 + Vite 7 + TypeScript 5 |
| **Routing** | React Router 7 |
| **Styling** | Tailwind CSS, Radix UI primitives, shadcn-style components |
| **Editor** | TipTap 3 (StarterKit, Image, Link extensions) |
| **Backend** | Supabase (Auth + Postgres with RLS + Storage) |
| **Media** | IndexedDB, File System Access API, JSZip |
| **Anki parsing** | sql.js (SQLite in WASM) + fzstd (Zstandard) |
| **i18n** | i18next + react-i18next |
| **Sanitization** | DOMPurify |
| **PWA** | vite-plugin-pwa + Workbox |

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 10+
- A free [Supabase](https://supabase.com) account (no credit card needed)

### Installation

```bash
git clone https://github.com/<your-fork>/flash-learn.git
cd flash-learn
pnpm install
```

### Configuration

1. Create a new project at <https://supabase.com>.
2. In **Project Settings → API**, copy the **Project URL** and **anon public key** into a new `.env` at the repo root:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. In **SQL Editor**, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This creates the `profiles`, `decks`, `cards`, and `achievements` tables, triggers, and Row Level Security policies.
4. In **Storage**, create a new **private** bucket called `media`. The RLS policy on `storage.objects` from the migration already restricts access to each user's own folder.
5. In **Authentication → Providers**, enable **Google** and **GitHub** (paste OAuth client credentials from each provider). Email/password is enabled by default.
6. In **Authentication → URL Configuration**, set:
   - **Site URL**: `http://localhost:5173`
   - **Redirect URLs**: `http://localhost:5173/**` (add your production URL too when deploying).

### Running locally

```bash
pnpm dev          # start the dev server (http://localhost:5173)
pnpm build        # type-check + production build
pnpm preview      # serve the production build
pnpm lint         # run ESLint
```

## 🛡️ Security model

All access is gated by **Postgres Row Level Security** (see `supabase/migrations/0001_init.sql`):

- `profiles`, `cards`, `achievements`: each row is readable/writable only by its owner.
- `decks`: owner can read/write; rows marked `is_public = true` are readable by anyone authenticated.
- `storage.objects` (bucket `media`): scoped to `${uid}/...` paths via a single policy.

Storage URLs are **signed** with a 7-day TTL and cached in IndexedDB on the client to avoid extra round-trips.

## 🗂️ Project Structure

```
src/
├── components/         # Reusable UI (CardEditor, RichContent, PlayAudioButton, ui/)
├── context/            # React contexts (AuthContext)
├── i18n/               # i18next setup + locales/{en,pt}.json
├── lib/                # Firebase init + sanitize helpers
├── pages/              # Route-level views (Dashboard, DeckDetail, StudySession, Profile, ...)
└── services/           # Data + domain logic
    ├── AnkiImportService.ts        # .apkg/.colpkg/.csv parsing
    ├── CardService.ts              # Card CRUD + review processing
    ├── DeckService.ts              # Deck CRUD
    ├── DeckExportService.ts        # Export decks to .fldeck.zip
    ├── GamificationService.ts      # Points, streaks, achievements
    ├── LocalDirectoryService.ts    # File System Access API wrapper
    ├── MediaStorageService.ts      # Supabase Storage wrapper + signed URL cache
    ├── MediaSyncService.ts         # Legacy audio bundle import/export
    ├── UserSettingsService.ts      # Per-user settings cache
    ├── _mappers.ts                 # snake_case ↔ camelCase converters
    └── srsAlgorithm.ts             # SM-2 spaced repetition
```

## 🧪 Importing from Anki

Flash Learn understands the formats Anki exports:

| Format | Extension | Notes |
|--------|-----------|-------|
| Anki package | `.apkg`, `.colpkg` | Includes images, audio, and HTML formatting |
| Tab/comma/semicolon delimited | `.txt`, `.csv`, `.tsv` | Auto-detects delimiter |

Cloze notes (`{{c1::answer}}`) are converted into front/back pairs. Inline `[sound:foo.mp3]` markers and `<img src="...">` references are preserved and rewritten to use the app's `media://` scheme.

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Run the linter and type-checker before pushing
4. Open a pull request describing the change and the motivation

For larger changes, please open an issue first to discuss the direction.

## 🗺️ Roadmap

- [ ] Cloud-synced media storage (Firebase Storage backend)
- [ ] Cross-device sync of card media via Firestore references
- [ ] Mobile-optimized study mode with swipe gestures
- [ ] Public deck rating and comments
- [ ] More import formats (Quizlet, Mochi, RemNote)

## 📄 License

Released under the [MIT License](LICENSE).

## 🙏 Acknowledgements

- [Anki](https://apps.ankiweb.net) — for pioneering the open flashcard format Flash Learn interoperates with
- [TipTap](https://tiptap.dev) — headless, framework-agnostic rich-text editor
- [shadcn/ui](https://ui.shadcn.com) — design patterns for Radix-based components
- [sql.js](https://sql.js.org) — SQLite compiled to WebAssembly, used to read `.apkg` collections

---

<div align="center">

**Built with ❤️ for learners who want to remember, not just review.**

</div>

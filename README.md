<div align="center">

# 🧠 Flash Learn

**An open-source, Anki-inspired flashcard app with spaced repetition, rich-content cards, and community decks.**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
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
| **Backend** | Firebase (Auth + Firestore + Storage) |
| **Media** | IndexedDB, File System Access API, JSZip |
| **Anki parsing** | sql.js (SQLite in WASM) + fzstd (Zstandard) |
| **i18n** | i18next + react-i18next |
| **Sanitization** | DOMPurify |
| **PWA** | vite-plugin-pwa + Workbox |

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 10+
- A [Firebase](https://console.firebase.google.com) project with **Auth**, **Firestore**, and **Storage** enabled

### Installation

```bash
git clone https://github.com/<your-fork>/flash-learn.git
cd flash-learn
pnpm install
```

### Configuration

Create a `.env` file at the repo root using the Firebase web config from your project settings:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Running locally

```bash
pnpm dev          # start the dev server (http://localhost:5173)
pnpm build        # type-check + production build
pnpm preview      # serve the production build
pnpm lint         # run ESLint
```

## 🔥 Firebase setup notes

Minimum Firestore security rules to scope data per-user (adjust to your needs):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /decks/{deckId} {
      allow read: if resource.data.isPublic == true
        || (request.auth != null && resource.data.ownerId == request.auth.uid);
      allow write: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
    }
    match /cards/{cardId} {
      allow read, write: if request.auth != null
        && resource.data.ownerId == request.auth.uid;
    }
  }
}
```

Storage rules for per-user media:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

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
    ├── MediaStorageService.ts      # Unified media backend (IDB + folder + cloud)
    ├── MediaSyncService.ts         # Legacy audio bundle import/export
    ├── UserSettingsService.ts      # Per-user settings (language, mediaBackend)
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

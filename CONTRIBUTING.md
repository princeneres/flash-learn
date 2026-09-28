# Contributing to Flash Learn

Thanks for taking the time to contribute. Bug reports, ideas, translations and pull requests are all welcome.

## Before you start

- **Bugs:** open an issue with the steps to reproduce, what you expected, what happened, and your browser and
  device. Screenshots help.
- **Features:** open an issue first for anything bigger than a small fix, so we can agree on the approach.
- **Security issues:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Development setup

Follow [Getting started](README.md#getting-started). With a Neon project configured in `.env.local`, create a
[branch](https://neon.com/docs/introduction/branching) for your work so you never touch production data:

```bash
pnpm install
pnpm db:migrate         # applies db/migrations/ to DATABASE_URL
pnpm dev                # app + api/ functions on http://localhost:5173
```

## Guidelines

- **TypeScript and React function components**, formatted with Prettier (`pnpm format`) and linted with ESLint
  (`pnpm lint`).
- **Database changes go in a new migration** under `db/migrations/` (applied with `pnpm db:migrate`). Never edit a migration that has
  already been applied. Regenerate `src/types/database.ts` with `pnpm db:types` when the schema changes.
- **Security lives in the database.** New tables need Row Level Security policies. Anything that awards points
  or enforces limits belongs in a trigger or a `SECURITY DEFINER` function, not in client code.
- **Every user-facing string goes through i18next**, with entries in both `src/i18n/locales/en.json` and
  `pt.json`.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org), written in English.

## Pull requests

Run `pnpm lint` and `pnpm build` before pushing. In the pull request, describe the change, why it is needed and
how you tested it, with screenshots for UI changes.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

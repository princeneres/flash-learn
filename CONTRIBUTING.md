# Contributing to Flash Learn

Thanks for taking the time to contribute. Bug reports, ideas, translations and pull requests are all welcome.

## Before you start

- **Bugs:** open an issue with the steps to reproduce, what you expected, what happened, and your browser and
  device. Screenshots help.
- **Features:** open an issue first for anything bigger than a small fix, so we can agree on the approach.
- **Security issues:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Development setup

Follow [Getting started](README.md#getting-started). The quickest fully local setup is:

```bash
pnpm install
supabase start          # local Postgres, Auth and Storage with all migrations applied
# put the printed API URL and anon key in .env.local
pnpm dev
```

## Guidelines

- **TypeScript and React function components**, formatted with Prettier (`pnpm format`) and linted with ESLint
  (`pnpm lint`).
- **Database changes go in a new migration** under `supabase/migrations/`. Never edit a migration that has
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

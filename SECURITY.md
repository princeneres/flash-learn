# Security Policy

## Supported versions

Security fixes land on the `master` branch and are deployed to
[flashlearn.princeneres.dev](https://flashlearn.princeneres.dev). Self-hosted installations should track `master`.

## Reporting a vulnerability

Please do not report security issues in public issues or pull requests.

Use GitHub's private reporting instead: open the repository's **Security** tab and choose
**Report a vulnerability**. Include the steps to reproduce, the impact you observed, and whether the live app is
affected.

You can expect an acknowledgement within a few days and a status update as the fix progresses. Please give us
reasonable time to fix the issue before disclosing it publicly.

## Scope

Especially relevant areas:

- Row Level Security policies, triggers and RPCs in `db/migrations/`
- Server functions in `api/`, including storage authorization and the billing webhook signature check
- Rendering of user-authored card HTML (`src/components/RichContent.tsx`, `src/lib/sanitize.ts`)
- The MCP server login flow (`mcp-server/src/login.ts`, `src/pages/ConnectMcp.tsx`)

Do not test against other users' data on the live app. Use your own account or your own Neon project.

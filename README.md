# Syllo

Syllo is a personal learning and reading app. Resume a lesson, read an EPUB, keep notes tied to a source, and review concepts you choose to remember.

The Spacious design provides Home, Library, Learn, Reviews, Scout, and Settings. Home shows your actual topics and reading position. Library offers book spines or a searchable list. The EPUB reader uses the book's real contents and saves passages, highlights, and your place. Lessons embed videos with saved timestamps and an optional Pomodoro.

Scout finds free resources, reads the available source text, and asks you to keep or skip its picks. A generated roadmap stays a draft until you edit and approve it. Suggested review cards only enter the FSRS schedule when kept. Manual resource entry works without AI.

## Run locally

Use Node 22.12 or newer and pnpm. Run commands from the repo root unless noted:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. Convex is optional. With `VITE_CONVEX_URL` blank, progress uses browser storage and EPUB files use IndexedDB. No account is needed.

Read [setup instructions](docs/syllo-setup.md) for optional private Convex sync, free Gemini configuration, the local transcript worker, Android use, and backups. No Convex project is configured in this checkout.

## Stack and data

TanStack Start and Router, React 19, TypeScript, Tailwind v4, epub.js, ts-fsrs, and an optional Convex backend. Scout runs in the Node server with a local SQLite database. It needs a Gemini key from an unbilled Google AI Studio project for generation; paid provider fallbacks are disabled.

Existing workspace routes, editing tools, and the `zns:v2:workspace-state` storage key remain supported. The new bridge preserves an original local backup before syncing roadmaps and review cards. Settings exports metadata, including the legacy workspace backup. Original EPUBs and API keys are excluded.

Convex sync is prepared for one owner, with password login restricted by `SYLLO_OWNER_EMAIL` and authenticated file downloads. Without a configured deployment, all local features remain available. Live cloud integration still needs a project and account setup.

## Development

```powershell
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm start
```

`pnpm typecheck` checks both the app and `apps/web/convex/`.

The production server serves `dist/client` and the TanStack SSR handler on loopback port 3000. `pnpm start` does not read an env file automatically; pass environment variables or run `node --env-file=.env.local server.mjs` in `apps/web`. Deployment URLs are build-time settings.

`apps/web/mcp/server.mjs` supplies a local stdio MCP server for coding agents to add and search resource candidates. Connection snippets are available in Settings.

## Project layout

The repo is a pnpm workspace. Each app lives under `apps/`, and code shared between apps goes under `packages/`.

```text
apps/web/                         The Syllo app (TanStack Start), its env files and local .data/
apps/web/src/routes/              Routes and server API handlers
apps/web/src/views/studio/        Learning, reading, review, Scout, and settings pages
apps/web/src/components/learning/ EPUB covers, video player, cards, and Pomodoro
apps/web/src/components/sync/     Optional Convex provider and local workspace bridge
apps/web/src/lib/personal/        Validated records, browser files, and sync references
apps/web/src/lib/scout/           Discovery, extraction, planning, SQLite, and jobs
apps/web/convex/                  Private account, document sync, and file functions
apps/web/mcp/                     Local coding-agent resource tools
```

This app is personal-first. Forks can use their own deployment, books, preferences, and keys. Public publishing and multi-user collaboration are outside v1. Earlier gallery/share routes remain in the codebase; personal sync does not publish learning records through them.

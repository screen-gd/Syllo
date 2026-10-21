# Syllo

Syllo turns raw guides, playbooks, curricula, and notes into interactive learning workspaces. Paste content or upload a markdown file, let the AI structure it, and work through modules, tasks, resources, notes, and progress tracking in one place.

## Features

- AI-powered parsing for roadmaps, playbooks, tutorials, strategies, and other structured content
- Interactive workspace with modules, milestones, notes, resources, videos, and progress tracking
- Local-first persistence — all workspace data stays in your browser
- Markdown, JSON, and PDF export
- User-configurable AI provider, model, and API key
- Spaced-repetition review cards, coaching check-ins, and a 90-day review
- Public gallery, share links, and an embeddable workspace view
- Scout: find free resources for a goal, approve the picks, and publish a learning workspace

## Stack

- [TanStack Start](https://tanstack.com/start) (SSR + server functions)
- [TanStack Router](https://tanstack.com/router) file-based routes
- React 19
- TypeScript
- Tailwind CSS v4
- Vite 8

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create `.env` (see `.env.example`) with the variables you need:

```env
# Public origin used in metadata, robots.txt and sitemap.xml
VITE_APP_URL=http://localhost:3000

# Access gate (password lock) - required to pass /gate
GATE_PASSWORD=change-me-to-a-strong-password

# Optional server-side OpenAI key used as a fallback for studio AI
OPENAI_API_KEY=
```

3. Start the app:

```bash
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000). The password gate is in front of every route; set `GATE_PASSWORD` before opening it, because an empty password fails closed.

## Scripts

- `npm run dev` — start the Vite dev server with SSR
- `npm run build` — build the client and server bundles into `dist/`
- `npm run start` — serve the production build with `server.mjs`
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript without emitting files
- `npm run test` — run the Vitest suite

`npm start` requires `npm run build` first. It serves `dist/client` as static assets and forwards every other request to the SSR handler in `dist/server/server.js` on `PORT` (default `3000`).

## Scout

Scout lives at `/scout`. Describe a goal, let it find free videos, articles and docs, keep the picks you want, and it publishes a workspace with modules, deep-linked resources, notes and review cards. Books are not ingested: a book becomes reading tasks with chapters, and your notes attach to them.

Scout runs on the server with one SQLite file (`.data/syllo.db` by default; override with `SCOUT_DB_PATH`). The queue lives in the same file, so discovery keeps working after a restart. Learner progress stays in browser storage, keyed by stable pack and task IDs.

### What works without keys

- **Discovery:** YouTube channel uploads use `YOUTUBE_API_KEY`; without it Scout reads channel RSS and page HTML. The open-web half uses `EXA_API_KEY` and is skipped when unset. Nothing calls `search.list`.
- **Text:** YouTube transcripts use the local Python helper (`youtube-transcript-api`) and fall back to `SUPADATA_API_KEY`, then skip the video and mark it. Articles and docs go through Jina Reader and work keyless at a lower rate limit.
- **Generation:** summaries, key points, skill tags, roadmaps and quiz cards need an LLM. Use a key in Settings (per pack, kept in memory only) or set `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, etc. on the server. Nightly auto-check only discovers and stores links, so it needs no key and never rewrites an approved pack.
- **Nightly check:** on by default at 3:00 AM Asia/Dubai, tracking RSS for your saved YouTube sources. Pause Scout in the Sources panel to stop it.

Raw transcripts and article text stay in SQLite and are never returned by an API response. Scout does not re-host video or audio.

### Agents

Two directions, both local:

- **Your agent -> Scout.** `mcp/server.mjs` is a stdio MCP server with `add_resource` and `search_library`. It reads the same SQLite file as the app. Copy the ready-made config for opencode, Codex or Claude Code from Settings -> Agents (`?tab=agents`), which also lists which CLIs are installed.
- **Scout -> your agent.** Scout can hand one bounded research task to an installed agent CLI (`opencode run`, `codex exec --sandbox read-only`, `claude -p`). The agent gets the goal only, runs in an explicit folder with a timeout and no auto-approve flags, and its JSON output is validated before any link is saved.

ChatGPT's desktop connector expects a remote MCP URL, so use Codex locally or expose `mcp/server.mjs` through your own tunnel.

## Project Structure

```
src/
  routes/       Route definitions (file-based), loaders, server handlers
  views/        Page bodies rendered by routes
  components/   Shared UI (layout, workspace, marketing, ui primitives)
  lib/          Client utilities, storage, AI config
  lib/scout/    Scout pipeline, SQLite layer, prompts, provider clients
  lib/server/   Server-only stores, AI calls, gate, server functions
  styles/       Tailwind entry and theme tokens
mcp/            Stdio MCP server (`add_resource`, `search_library`)
prompts/scout/  Versioned Scout prompts
```

Keep server-only imports out of route components: anything that touches `src/lib/server/*` must go through a `createServerFn` or a server route handler.

## Project Notes

- Workspace data, notes, progress, and custom AI keys are stored in browser storage.
- Custom AI keys are sent only to the selected provider when used.
- Scout keeps packs, resources, queue jobs and spend in `.data/syllo.db`, which is git-ignored. Delete it to reset Scout.
- Server data (gallery entries, credits, privacy settings) is kept in memory for now, so share and embed links do not survive a restart.
- `npm start` runs the built SSR handler directly; there is no separate Nitro/hosting adapter in this repository.

## Open Source

This repository is still in active development. Expect UI and schema changes while the workspace model evolves.

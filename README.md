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

## Project Structure

```
src/
  routes/       Route definitions (file-based), loaders, server handlers
  views/        Page bodies rendered by routes
  components/   Shared UI (layout, workspace, marketing, ui primitives)
  lib/          Client utilities, storage, AI config
  lib/server/   Server-only stores, AI calls, gate, server functions
  styles/       Tailwind entry and theme tokens
```

Keep server-only imports out of route components: anything that touches `src/lib/server/*` must go through a `createServerFn` or a server route handler.

## Project Notes

- Workspace data, notes, progress, and custom AI keys are stored in browser storage.
- Custom AI keys are sent only to the selected provider when used.
- Server data (gallery entries, credits, privacy settings) is kept in memory for now, so share and embed links do not survive a restart.
- `npm start` runs the built SSR handler directly; there is no separate Nitro/hosting adapter in this repository.

## Open Source

This repository is still in active development. Expect UI and schema changes while the workspace model evolves.

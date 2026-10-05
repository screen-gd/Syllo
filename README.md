# Syllo

ZNS RoadMap Studio turns raw guides, playbooks, curricula, and notes into interactive learning workspaces. Paste content or upload a markdown file, let the AI structure it, and work through modules, tasks, resources, notes, and progress tracking in one place.

## Features

- AI-powered parsing for roadmaps, playbooks, tutorials, strategies, and other structured content
- Interactive workspace with modules, milestones, notes, resources, videos, and progress tracking
- Local-first persistence — all data stays in your browser
- Markdown, JSON, and PDF export
- User-configurable AI provider, model, and API key

## Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS v4

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with the variables you need:

```env
# Access gate (password lock) - required
GATE_PASSWORD=change-me-to-a-strong-password

# Optional: your own AI provider keys (used server-side for shared studio AI)
AI_PROVIDER=gemini
AI_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Start the app:

```bash
npm run dev
```

## Scripts

- `npm run dev` - start the local dev server
- `npm run build` - run a production build
- `npm run start` - start the production server
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript without emitting files

## Project Notes

- All data is stored locally in the browser (workspaces, notes, progress, credits).
- Custom AI keys are stored in browser storage and sent only to the selected provider when used.
- Optional server-side AI keys can be set in `.env.local` for shared studio AI.

## Open Source

This repository is still in active development. Expect UI and schema changes while the workspace model evolves.

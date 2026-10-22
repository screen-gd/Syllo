# Syllo setup

## Local mode

Use Node 22.12 or newer, npm, and a browser with IndexedDB. No Convex account is needed.

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. Leave `VITE_CONVEX_URL` blank. Home, Library, EPUB reading, notes, video bookmarks, Pomodoro, manual roadmaps, and reviews save on this browser. Videos still need an internet connection.

For a production build:

```powershell
npm run build
npm start
```

The production host listens on `127.0.0.1:3000` by default. Vite reads `.env.local` during development and builds. For server keys used by `npm start`, supply process environment variables or run `node --env-file=.env.local server.mjs`. Client deployment URLs are build-time settings, so rebuild after changing them.

## Optional Convex sync

No deployment is configured in this checkout. The backend schema, owner-only password login, sync functions, and authenticated book downloads are prepared in `convex/`. Local mode remains available without them.

1. Run `npm run convex:dev`. Sign in to Convex and choose a project and its development deployment. This writes deployment settings to your ignored `.env.local`. Keep this watcher running; an initial auth error can be resolved by configuring the following variables.
2. Run `npm run convex:auth-prepare` in a second terminal. It generates `.env.convex-auth.local` without printing keys or contacting Convex. It refuses to overwrite existing keys.
3. Apply those variables to your selected development deployment:

   ```powershell
   npx convex env set --from-file .env.convex-auth.local
   npx convex env set SYLLO_OWNER_EMAIL
   npx convex env set SITE_URL http://localhost:3000
   ```

   Enter your email at the private terminal prompt. Only that address may create or use the account. Keep `.env.convex-auth.local` private and outside version control. Do not regenerate signing keys for an existing deployment unless you intend to rotate them.
4. Confirm `.env.local` has the public `VITE_CONVEX_URL` from the CLI. For the standard Convex domain, Syllo derives the HTTP origin by replacing `.convex.cloud` with `.convex.site`. Set `VITE_CONVEX_SITE_URL` explicitly if needed. Never put signing keys or deployment access tokens in a `VITE_` variable.
5. Restart `npm run dev`. In Settings, choose **First time? Create account**, use the configured owner email, and save your password in a password manager. This personal setup does not include email verification or password-reset delivery.
6. In Settings, choose **Upload books from this device** for previously imported books. New imports upload when signed in. Reading positions, highlights, notes, kept review schedules, roadmaps, and timer preferences sync automatically. Downloads require sign-in and cache locally for later use.

The auth files follow [Convex Auth's manual setup](https://labs.convex.dev/auth/setup/manual); Syllo's schema and React provider are already installed. Avoid replacing `convex/auth.ts` with a generic setup template, which would remove the owner-email restriction.

For a hosted origin, set Convex's `SITE_URL` to that exact origin and rebuild the app with its deployment URLs. The app's server APIs require the Convex sign-in token when connected. The local Scout SQLite database is a single-owner worker; it is not a multi-user backend.

Convex limits depend on your plan. This setup does not enable billing or upgrade the project. File uploads are limited to 50 MB per book, and cloud sync refuses individual metadata records above 750 KB while keeping them locally.

## Free Scout setup

Scout needs a Gemini API key for discovery and generation. Use a project with billing disabled in Google AI Studio. Add the key in Syllo Settings, or set `GEMINI_API_KEY` on the local worker. Browser keys stay in that browser and are sent to the worker for the current pack; the worker keeps them in memory, not SQLite. Server restart loses per-pack keys, so start a new pack or configure the server key.

Only `gemini-2.5-flash` and `gemini-2.5-flash-lite` are allowed. Broad web discovery uses Flash with Google Search grounding; generated source URLs are resolved and pages are read before they enter a roadmap. Google currently lists both models' text generation and limited search grounding in its [free tier](https://ai.google.dev/gemini-api/docs/pricing). Availability and quotas depend on your project. Syllo cannot infer whether a key belongs to a billed project, so use an unbilled one to enforce zero spend. A quota response pauses Scout for 15 minutes without switching to another provider.

An optional `YOUTUBE_API_KEY` enables broad YouTube search and metadata within Google's quota. Without it, creator RSS and grounded web search supply candidates. Creators are preferences; discovery is not restricted to them.

Install the local transcript helper with the Python interpreter available to the app:

```powershell
python -m pip install youtube-transcript-api
```

Scout reads captions from your machine, caches source text in `.data/syllo.db`, and spaces transcript attempts apart. Some videos have no readable captions or block requests. Those stay visible as manual links, without generated clips or summaries. Articles use keyless Jina Reader with direct fetch as a fallback. Paid transcript and search fallback services are disabled.

Scout's flow is goal, source review, draft roadmap, then your explicit approval. Review cards are suggestions until kept. You can add URLs manually without an AI key. Optional creator RSS checks are off on a fresh database; if enabled, they run at 03:00 Asia/Dubai while the local worker runs. They only suggest links and do not rewrite approved roadmaps.

## Where data lives

| Data | Local storage | Optional cloud |
| --- | --- | --- |
| Books and covers | IndexedDB `syllo-library` | Private Convex file storage |
| Positions, highlights, notes, FSRS cards, timer preferences | `syllo:personal:v1` in localStorage | Owner's Convex documents |
| Existing roadmaps and workspace history | Original `zns:v2:workspace-state` key | Roadmaps and review cards sync; old session/history records stay local |
| Original workspace before the new bridge | `syllo:workspace-before-personal-v1` | Excluded |
| Scout drafts, sources, transcripts, jobs | Local `.data/syllo.db` SQLite file | Excluded |
| AI keys | Browser settings or worker environment | Excluded |

Settings exports metadata and the legacy workspace backup. EPUB binaries and API keys are excluded; retain your original books. Restore merges newer metadata by record timestamp. Sync uses the newest revision of each record, including deletion markers; simultaneous edits to the same record do not merge individual fields. Signing out keeps this device's local cache.

## Android and offline use

The production build includes a web app manifest and a service worker. Add Syllo to the Android home screen from Chrome. Service workers need HTTPS or localhost. After installation, reload and visit the pages you want cached while online. Previously visited learning pages and cached EPUBs can then open offline; Scout and streaming video require connectivity. Development mode does not register a worker.

Embedded YouTube playback uses YouTube's player. Syllo does not promise locked-phone playback without Premium. For free external listening, use an Android player such as NewPipe or a browser with background playback, then update your position manually in the lesson. Syllo cannot observe external playback progress.

## Coding agents and checks

`mcp/server.mjs` exposes `add_resource` and `search_library` over stdio against the same SQLite file. Settings shows connection snippets for installed coding agents. An MCP-added resource remains a candidate until approved.

```powershell
npm run typecheck
npm run typecheck:convex
npm test
npm run lint
npm run build
```

Live Convex sync, provider calls, mobile installation, and playback need their respective accounts, devices, or network services. No cloud project is created by these checks.

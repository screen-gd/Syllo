# Closure Website

Standalone marketing site, extracted from the root app's `app/(marketing)` route group so the repo holds both the product app (root) and the website (`/website`) side by side.

## Contents

- `app/(marketing)/` — marketing pages (home, contact, gallery, pricing, privacy, terms) copied from root
- `app/layout.tsx`, `app/globals.css`, `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/twitter-image.tsx` — site shell + SEO
- `components/layout/Header.tsx`, `components/layout/Footer.tsx` — marketing chrome
- `public/` — favicon, manifest, brand assets

## Status

Extraction copy only — root `app/(marketing)` is still in place and will be removed from the root app during the product-workspace rewrite (see `docs/adr/0001-pivot-to-product-workspace.md`). Styling still references root design tokens; full standalone wiring (Tailwind config, fonts, remaining shared components) is part of the rewrite tickets.

## Run

```bash
cd website
npm install
npm run dev
```

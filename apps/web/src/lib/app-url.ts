/**
 * Single source of truth for the public origin used in metadata, robots.txt
 * and sitemap.xml. Set `VITE_APP_URL` in the environment (see .env.example).
 */
const FALLBACK_APP_URL = "https://roadmap.znsnexus.com";

export function getAppUrl(): string {
    return import.meta.env.VITE_APP_URL || FALLBACK_APP_URL;
}

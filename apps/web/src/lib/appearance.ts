import { useSyncExternalStore } from "react";
import { z } from "zod";

/**
 * Appearance is one preference: light, dark, or follow the system. It is
 * stored under `syllo_theme` and paints only `data-theme` on the root
 * element; every colour comes from Glaze tokens. The pre-paint script in
 * __root.tsx applies the same resolution, so the two stay in lockstep.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "syllo_theme";

// Keys from the retired custom-theme system, removed on first apply.
const LEGACY_KEYS = ["syllo_appearance_v1", "syllo_appearance_boot"] as const;

const preferenceSchema = z.enum(["light", "dark", "system"]);
export const DEFAULT_PREFERENCE: ThemePreference = "system";

function systemTheme(): ResolvedTheme {
    if (typeof window === "undefined" || !window.matchMedia) return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
    return preference === "system" ? systemTheme() : preference;
}

export function getThemePreference(): ThemePreference {
    if (typeof window === "undefined") return DEFAULT_PREFERENCE;
    try {
        const parsed = preferenceSchema.safeParse(
            JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? "null"),
        );
        return parsed.success ? parsed.data : DEFAULT_PREFERENCE;
    } catch {
        return DEFAULT_PREFERENCE;
    }
}

export function saveThemePreference(preference: ThemePreference): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference));
}

export const APPEARANCE_EVENT = "syllo:appearance";

function subscribeAppearance(callback: () => void): () => void {
    window.addEventListener(APPEARANCE_EVENT, callback);
    window.addEventListener("storage", callback);
    return () => {
        window.removeEventListener(APPEARANCE_EVENT, callback);
        window.removeEventListener("storage", callback);
    };
}

/**
 * The stored preference, safe under SSR hydration: the server snapshot is
 * always "system" (localStorage does not exist there), so hydration matches
 * and the real value settles right after mount. Re-reads on the
 * `syllo:appearance` event applyTheme dispatches and on cross-tab `storage`.
 */
export function useThemePreference(): ThemePreference {
    return useSyncExternalStore(
        subscribeAppearance,
        getThemePreference,
        () => DEFAULT_PREFERENCE,
    );
}

let listening = false;

/**
 * Paints the resolved theme: `data-theme` and `colorScheme` on the root, and
 * the theme-color meta from the computed `--page` of the `.glaze` body. While
 * the preference is "system" it keeps listening for OS changes; any other
 * preference drops the listener. Removes the retired appearance keys once.
 */
export function applyTheme(
    preference: ThemePreference,
    { animate = false }: { animate?: boolean } = {},
): void {
    if (typeof document === "undefined") return;
    // A theme the person picks crossfades instead of flashing from light to dark (styles/syllo.css times it).
    const crossfade =
        animate &&
        resolveTheme(preference) !== document.documentElement.dataset.theme &&
        typeof document.startViewTransition === "function" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (crossfade) {
        document.startViewTransition(() => paintTheme(preference));
        return;
    }
    paintTheme(preference);
}

function paintTheme(preference: ThemePreference): void {
    const resolved = resolveTheme(preference);
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
    }
    const page = document.body
        ? getComputedStyle(document.body).getPropertyValue("--page").trim()
        : "";
    if (page) meta.content = page;
    try {
        for (const key of LEGACY_KEYS) localStorage.removeItem(key);
    } catch {
        /* Private mode can refuse storage; the keys are cosmetic. */
    }
    window.dispatchEvent(new Event(APPEARANCE_EVENT));
    if (listening || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
        if (getThemePreference() === "system")
            applyTheme("system", { animate: true });
    });
    listening = true;
}

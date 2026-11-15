// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import {
    applyTheme,
    DEFAULT_PREFERENCE,
    getThemePreference,
    resolveTheme,
    saveThemePreference,
    THEME_STORAGE_KEY,
} from "@/lib/appearance";

type MediaHandler = (event: { matches: boolean }) => void;
let mediaState = { matches: false };
// applyTheme registers its media listener once for the app's lifetime, so
// handlers accumulate across tests the way they do in the browser.
const mediaHandlers: MediaHandler[] = [];

beforeEach(() => {
    localStorage.clear();
    mediaState = { matches: false };
    delete document.documentElement.dataset.theme;
    window.matchMedia = ((query: string) => ({
        get matches() {
            return mediaState.matches;
        },
        media: query,
        addEventListener: (_: string, handler: MediaHandler) => mediaHandlers.push(handler),
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
    })) as unknown as typeof window.matchMedia;
});

describe("getThemePreference", () => {
    it("defaults to system when storage is missing or invalid", () => {
        expect(getThemePreference()).toBe(DEFAULT_PREFERENCE);
        localStorage.setItem(THEME_STORAGE_KEY, "not json");
        expect(getThemePreference()).toBe("system");
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify("sepia"));
        expect(getThemePreference()).toBe("system");
    });

    it("reads a saved preference", () => {
        saveThemePreference("dark");
        expect(getThemePreference()).toBe("dark");
    });
});

describe("resolveTheme", () => {
    it("passes explicit preferences through", () => {
        expect(resolveTheme("light")).toBe("light");
        expect(resolveTheme("dark")).toBe("dark");
    });

    it("resolves system from the media query", () => {
        expect(resolveTheme("system")).toBe("light");
        mediaState.matches = true;
        expect(resolveTheme("system")).toBe("dark");
    });
});

describe("applyTheme", () => {
    it("sets data-theme and colorScheme on the root", () => {
        applyTheme("dark");
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(document.documentElement.style.colorScheme).toBe("dark");
    });

    it("removes the retired appearance keys", () => {
        localStorage.setItem("syllo_appearance_v1", "{}");
        localStorage.setItem("syllo_appearance_boot", "{}");
        applyTheme("light");
        expect(localStorage.getItem("syllo_appearance_v1")).toBeNull();
        expect(localStorage.getItem("syllo_appearance_boot")).toBeNull();
    });

    it("follows media changes while the preference is system", () => {
        saveThemePreference("system");
        applyTheme("system");
        mediaState.matches = true;
        for (const handler of mediaHandlers) handler({ matches: true });
        expect(document.documentElement.dataset.theme).toBe("dark");
    });

    it("ignores media changes for an explicit preference", () => {
        saveThemePreference("light");
        applyTheme("light");
        mediaState.matches = true;
        for (const handler of mediaHandlers) handler({ matches: true });
        expect(document.documentElement.dataset.theme).toBe("light");
    });
});

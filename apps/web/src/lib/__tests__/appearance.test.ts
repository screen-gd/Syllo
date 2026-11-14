import { describe, expect, it, beforeEach } from "vitest";
import {
    appearanceSchema,
    contrastRatio,
    DEFAULT_APPEARANCE,
    DEFAULT_THEME_ID,
    getAppearance,
    PRESET_THEMES,
    resolveTheme,
    saveAppearance,
    schemeOf,
    STORAGE_KEY,
    themeSchema,
    type AppearanceTheme,
} from "@/lib/appearance";

function customTheme(overrides: Partial<AppearanceTheme> = {}): AppearanceTheme {
    return {
        id: "custom:1",
        name: "Mine",
        page: "#FAFAFA",
        surface: "#FFFFFF",
        text: "#111111",
        accent: "#226688",
        headingFont: "sans",
        ...overrides,
    };
}

beforeEach(() => {
    localStorage.clear();
});

describe("appearance schema", () => {
    it("rejects bad hex colours", () => {
        expect(themeSchema.safeParse(customTheme({ page: "cream" })).success).toBe(false);
        expect(themeSchema.safeParse(customTheme({ accent: "#12345" })).success).toBe(false);
        expect(themeSchema.safeParse(customTheme({ text: "#12345g" })).success).toBe(false);
    });

    it("rejects more than 20 custom themes", () => {
        const themes = Array.from({ length: 21 }, (_, i) => customTheme({ id: `custom:${i}` }));
        expect(
            appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, customThemes: themes }).success,
        ).toBe(false);
    });
});

describe("getAppearance", () => {
    it("returns defaults when storage is missing or invalid", () => {
        expect(getAppearance()).toEqual(DEFAULT_APPEARANCE);
        localStorage.setItem(STORAGE_KEY, "not json");
        expect(getAppearance()).toEqual(DEFAULT_APPEARANCE);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2 }));
        expect(getAppearance()).toEqual(DEFAULT_APPEARANCE);
    });

    it("falls back to Study Desk for an unknown active theme id", () => {
        saveAppearance({ ...DEFAULT_APPEARANCE, activeThemeId: "custom:gone" });
        expect(getAppearance().activeThemeId).toBe(DEFAULT_THEME_ID);
    });

    it("accepts a custom theme as active", () => {
        const theme = customTheme();
        saveAppearance({ ...DEFAULT_APPEARANCE, activeThemeId: theme.id, customThemes: [theme] });
        expect(getAppearance().activeThemeId).toBe(theme.id);
    });
});

describe("resolveTheme", () => {
    it("finds presets and custom themes", () => {
        expect(resolveTheme(DEFAULT_APPEARANCE).id).toBe("preset:study-desk");
        const theme = customTheme();
        const appearance = { ...DEFAULT_APPEARANCE, activeThemeId: theme.id, customThemes: [theme] };
        expect(resolveTheme(appearance)).toEqual(theme);
        expect(resolveTheme({ ...appearance, activeThemeId: "preset:night" }).name).toBe("Night");
    });
});

describe("schemeOf", () => {
    it("sees light and dark themes", () => {
        expect(schemeOf(PRESET_THEMES[0])).toBe("light");
        expect(schemeOf(PRESET_THEMES[3])).toBe("dark");
        expect(schemeOf(PRESET_THEMES[1])).toBe("light");
    });
});

describe("contrastRatio", () => {
    it("computes WCAG ratios for known pairs", () => {
        expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 0);
        expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
        expect(contrastRatio("#F7F7F5", "#18191B")).toBeCloseTo(17, 0);
    });
});

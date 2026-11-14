import { z } from "zod";

/**
 * Appearance settings: a named theme is four hex seeds plus a heading font,
 * and the background is a local image behind a tinted page. Everything else
 * in the app derives from the seeds in CSS, so these few values repaint it.
 */
export const STORAGE_KEY = "syllo_appearance_v1";
const BOOT_KEY = "syllo_appearance_boot";

const hex6 = z.string().regex(/^#[0-9a-f]{6}$/i);

export const themeSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(40),
    page: hex6,
    surface: hex6,
    text: hex6,
    accent: hex6,
    headingFont: z.enum(["serif", "sans"]),
});
export const backgroundSchema = z.object({
    enabled: z.boolean(),
    tint: z.number().min(0.4).max(0.95),
    blur: z.number().min(0).max(24),
});
export const appearanceSchema = z.object({
    version: z.literal(1),
    activeThemeId: z.string(),
    customThemes: z.array(themeSchema).max(20),
    background: backgroundSchema,
});

export type AppearanceTheme = z.infer<typeof themeSchema>;
export type AppearanceBackground = z.infer<typeof backgroundSchema>;
export type Appearance = z.infer<typeof appearanceSchema>;
export type Scheme = "light" | "dark";

export const PRESET_THEMES: AppearanceTheme[] = [
    {
        id: "preset:study-desk",
        name: "Study Desk",
        page: "#F4EEE2",
        surface: "#FFFCF5",
        text: "#2B2622",
        accent: "#B5532A",
        headingFont: "serif",
    },
    {
        id: "preset:paper",
        name: "Paper",
        page: "#F7F7F5",
        surface: "#FFFFFF",
        text: "#18191B",
        accent: "#3F4CC4",
        headingFont: "sans",
    },
    {
        id: "preset:sage",
        name: "Sage",
        page: "#EEF1EA",
        surface: "#FBFCF9",
        text: "#20261F",
        accent: "#3F7355",
        headingFont: "serif",
    },
    {
        id: "preset:night",
        name: "Night",
        page: "#17181B",
        surface: "#202226",
        text: "#ECEAE4",
        accent: "#8FA2FF",
        headingFont: "sans",
    },
];

export const DEFAULT_THEME_ID = "preset:study-desk";
const STUDY_DESK = PRESET_THEMES[0];
export const DEFAULT_BACKGROUND: AppearanceBackground = { enabled: false, tint: 0.8, blur: 0 };
export const DEFAULT_APPEARANCE: Appearance = {
    version: 1,
    activeThemeId: DEFAULT_THEME_ID,
    customThemes: [],
    background: DEFAULT_BACKGROUND,
};

export function resolveTheme(appearance: Appearance): AppearanceTheme {
    return (
        appearance.customThemes.find((theme) => theme.id === appearance.activeThemeId) ??
        PRESET_THEMES.find((theme) => theme.id === appearance.activeThemeId) ??
        STUDY_DESK
    );
}

export function getAppearance(): Appearance {
    if (typeof window === "undefined") return DEFAULT_APPEARANCE;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = appearanceSchema.safeParse(raw ? JSON.parse(raw) : null);
        if (!parsed.success) return DEFAULT_APPEARANCE;
        const appearance = parsed.data;
        const known =
            appearance.customThemes.some((theme) => theme.id === appearance.activeThemeId) ||
            PRESET_THEMES.some((theme) => theme.id === appearance.activeThemeId);
        return known ? appearance : { ...appearance, activeThemeId: DEFAULT_THEME_ID };
    } catch {
        return DEFAULT_APPEARANCE;
    }
}

export function saveAppearance(appearance: Appearance): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
}

function channel(hex: string, index: number) {
    const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a #RRGGBB colour. */
export function relativeLuminance(hex: string): number {
    return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

export function schemeOf(theme: AppearanceTheme): Scheme {
    return relativeLuminance(theme.page) < 0.4 ? "dark" : "light";
}

export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Repaints the app: seeds go on the root element, scheme and heading font on
 * data attributes, and a boot record in localStorage lets the inline head
 * script set the same values before first paint on the next load.
 */
export function applyAppearance(appearance: Appearance): void {
    if (typeof document === "undefined") return;
    const theme = resolveTheme(appearance);
    const scheme = schemeOf(theme);
    const root = document.documentElement;
    root.style.setProperty("--color-page", theme.page);
    root.style.setProperty("--color-surface", theme.surface);
    root.style.setProperty("--color-text", theme.text);
    root.style.setProperty("--color-accent", theme.accent);
    root.dataset.scheme = scheme;
    root.dataset.headingFont = theme.headingFont;
    if (appearance.background.enabled) {
        root.dataset.bg = "on";
        root.style.setProperty("--sy-bg-tint", String(appearance.background.tint));
        root.style.setProperty("--sy-bg-blur", `${appearance.background.blur}px`);
    } else {
        delete root.dataset.bg;
        root.style.removeProperty("--sy-bg-tint");
        root.style.removeProperty("--sy-bg-blur");
    }
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
    }
    meta.content = theme.page;
    window.dispatchEvent(new Event("syllo:appearance"));
    try {
        localStorage.setItem(
            BOOT_KEY,
            JSON.stringify({
                page: theme.page,
                surface: theme.surface,
                text: theme.text,
                accent: theme.accent,
                scheme,
                headingFont: theme.headingFont,
                bg: appearance.background.enabled
                    ? { tint: appearance.background.tint, blur: appearance.background.blur }
                    : null,
            }),
        );
    } catch {
        /* The boot record is a nicety; private mode can refuse it. */
    }
}

/* -- Background image blob (IndexedDB) ------------------------------------ */

const DATABASE = "syllo-appearance";
const STORE = "background";
const IMAGE_KEY = "image";
let database: Promise<IDBDatabase> | null = null;

function openDatabase() {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            database = null;
            reject(new Error("Image storage is unavailable in this browser."));
        };
    });
    return database;
}

export async function saveBackgroundImage(blob: Blob) {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE, "readwrite");
        transaction.objectStore(STORE).put(blob, IMAGE_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
            reject(new Error("The image could not be saved. Try a smaller file."));
    });
}

export async function getBackgroundImage(): Promise<Blob | null> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE).objectStore(STORE).get(IMAGE_KEY);
        request.onsuccess = () =>
            resolve(request.result instanceof Blob ? request.result : null);
        request.onerror = () => reject(new Error("Could not read the saved image."));
    });
}

export async function deleteBackgroundImage() {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE, "readwrite");
        transaction.objectStore(STORE).delete(IMAGE_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error("The image could not be removed."));
    });
}

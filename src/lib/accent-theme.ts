const DEFAULT_ACCENT = "#4F7CFF";

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex: string) {
    const trimmed = hex.trim();
    const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

    if (/^#[0-9a-f]{6}$/i.test(normalized)) {
        return normalized.toUpperCase();
    }

    if (/^#[0-9a-f]{3}$/i.test(normalized)) {
        const [, r, g, b] = normalized;
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    return DEFAULT_ACCENT;
}

function hexToRgb(hex: string) {
    const normalized = normalizeHex(hex).slice(1);
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
}

function rgbToHex(rgb: { b: number; g: number; r: number }) {
    return `#${[rgb.r, rgb.g, rgb.b]
        .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
        .join("")}`.toUpperCase();
}

function mixHex(base: string, target: string, weight: number) {
    const from = hexToRgb(base);
    const to = hexToRgb(target);
    const mix = clamp(weight, 0, 1);

    return rgbToHex({
        r: from.r + (to.r - from.r) * mix,
        g: from.g + (to.g - from.g) * mix,
        b: from.b + (to.b - from.b) * mix,
    });
}

export function buildAccentTheme(accentColor: string) {
    const accent = normalizeHex(accentColor);

    return {
        accent,
        accentStrong: mixHex(accent, "#0F172A", 0.22),
        accentSoft: mixHex(accent, "#FFFFFF", 0.9),
    };
}

export function applyAccentTheme(accentColor: string) {
    if (typeof document === "undefined") return;

    const theme = buildAccentTheme(accentColor);
    document.documentElement.style.setProperty("--color-accent", theme.accent);
    document.documentElement.style.setProperty("--color-accent-strong", theme.accentStrong);
    document.documentElement.style.setProperty("--color-accent-soft", theme.accentSoft);
}

export function applyVisualDensity(density: "default" | "compact") {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("density-compact", density === "compact");
}

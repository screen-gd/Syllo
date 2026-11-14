const DEFAULT_ACCENT = "#B5532A";

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

/**
 * Sets the accent seed. The soft and strong shades derive from it in CSS, so
 * only the one variable needs to change. Workspace branding scopes this to a
 * wrapper element instead of documentElement.
 */
export function applyAccentTheme(accentColor: string) {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--color-accent", normalizeHex(accentColor));
}

export function applyVisualDensity(density: "default" | "compact") {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("density-compact", density === "compact");
}

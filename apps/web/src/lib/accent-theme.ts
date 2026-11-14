export function applyVisualDensity(density: "default" | "compact") {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("density-compact", density === "compact");
}

/** Hues a topic can take. Dark enough to read as a dot or bar on the light theme, distinct enough to tell apart. */
const TOPIC_COLORS = [
    "#4f74c9",
    "#a5691f",
    "#3d8f66",
    "#b04a63",
    "#7a5cc9",
    "#2d8a93",
    "#9a7d1a",
    "#b4562a",
] as const;

/**
 * The colour that stands for a roadmap or book everywhere it appears. It is
 * derived from the id, so it stays the same across pages and devices.
 */
export function topicColor(id: string) {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return TOPIC_COLORS[hash % TOPIC_COLORS.length];
}

/** Inline style that hands the topic's colour to CSS as `--topic`. */
export function topicStyle(id: string) {
    return { "--topic": topicColor(id) } as React.CSSProperties;
}

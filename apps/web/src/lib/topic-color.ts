/** Hues a topic can take. Muted enough to sit on the dark theme, distinct enough to tell apart. */
const TOPIC_COLORS = [
    "#7aa7f0",
    "#e0a458",
    "#7fc8a0",
    "#d98a9c",
    "#a995e6",
    "#5fc2c9",
    "#d9c15a",
    "#e08a5f",
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

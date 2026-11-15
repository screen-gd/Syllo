import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept in sync as it changes. `serverValue` is what the server and the hydration pass
 * render, so markup matches before the real value settles right after mount.
 */
export function useMediaQuery({
    query,
    serverValue,
}: {
    query: string;
    serverValue: boolean;
}): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const list = window.matchMedia(query);
            list.addEventListener("change", onChange);
            return () => list.removeEventListener("change", onChange);
        },
        () => window.matchMedia(query).matches,
        () => serverValue,
    );
}

/** Below Tailwind's `sm` breakpoint (640px). */
export const PHONE_QUERY = "(max-width: 639px)";
/** At or above Tailwind's `lg` breakpoint (1024px). */
export const WIDE_QUERY = "(min-width: 1024px)";

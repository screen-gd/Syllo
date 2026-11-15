import { useEffect, useState, type RefObject } from "react";

/**
 * True once the window, or the given scroll container, has scrolled past `offset` pixels. Floating bars use it to show
 * their edge only while content sits under them.
 */
export function useScrolled({
    container,
    offset = 4,
}: {
    container?: RefObject<HTMLElement | null>;
    offset?: number;
} = {}): boolean {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const target = container?.current ?? null;
        const read = () =>
            setScrolled((target ? target.scrollTop : window.scrollY) > offset);
        read();
        const source = target ?? window;
        source.addEventListener("scroll", read, { passive: true });
        return () => source.removeEventListener("scroll", read);
    }, [container, offset]);
    return scrolled;
}

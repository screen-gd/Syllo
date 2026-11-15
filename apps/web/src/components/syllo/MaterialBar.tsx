import type { ComponentProps, RefObject } from "react";
import { useScrolled } from "@/hooks/useScrolled";
import { cn } from "@/lib/glaze/utils";

/**
 * A floating bar on a translucent material (styles/syllo.css): content scrolls under it, blurred, and its hairline
 * appears only once something has scrolled beneath it. Pass `scrollContainer` when the bar sits in a scrolling element
 * rather than the window.
 */
export default function MaterialBar({
    className,
    scrollContainer,
    ...props
}: ComponentProps<"header"> & {
    scrollContainer?: RefObject<HTMLElement | null>;
}) {
    const scrolled = useScrolled({ container: scrollContainer });
    return (
        <header
            data-scrolled={scrolled || undefined}
            className={cn("material-bar", className)}
            {...props}
        />
    );
}

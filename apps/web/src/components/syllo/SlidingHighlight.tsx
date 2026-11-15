import { motion } from "motion/react";
import { cn } from "@/lib/glaze/utils";
import { springs } from "./motion";

/**
 * The current-row highlight that slides from the old row to the new one. Render it inside the current row only, with
 * the same `group` for every row of one list: Motion moves the one element between them, starting from where it is
 * on screen, so a second click mid-slide reverses smoothly. Its host row needs `data-highlight-host` (styles/syllo.css
 * puts the highlight behind the row's content). Under reduced motion it jumps.
 */
export default function SlidingHighlight({
    group,
    look = "pressed",
    shape = "pill",
}: {
    /** Shared by every row of one list, unique across lists on screen. */
    group: string;
    /** pressed: the ink wash of a selected row. paper: a paper pill with a hairline, like a selected tab. */
    look?: "pressed" | "paper";
    /** pill for one-line rows, tag for list rows. */
    shape?: "pill" | "tag";
}) {
    return (
        <motion.span
            layoutId={group}
            aria-hidden="true"
            data-slot="sliding-highlight"
            transition={springs.highlight}
            className={cn(
                shape === "pill" ? "rounded-pill" : "rounded-tag",
                look === "paper" ? "border border-line-faint bg-paper" : "bg-pressed",
            )}
        />
    );
}

import type { Transition } from "motion/react";

/**
 * Syllo's springs, in Apple's duration and bounce terms. Every one is critically damped (bounce 0): nothing here
 * follows a flick, so nothing overshoots. A spring starts from the value on screen, so a sidebar toggled twice
 * reverses from where it is instead of jumping.
 */
export const springs = {
    /** A sidebar widening or narrowing. */
    drawer: { type: "spring", duration: 0.36, bounce: 0 },
    /** A scrim fading under a surface. */
    fade: { type: "tween", duration: 0.2, ease: [0.23, 1, 0.32, 1] },
} as const satisfies Record<string, Transition>;

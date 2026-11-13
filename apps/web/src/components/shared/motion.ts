/** Default UI spring: critically damped, no overshoot (Apple damping 1.0, response ~0.35). */
export const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;
/** Scrim and other opacity-only fades. */
export const FADE = { duration: 0.2, ease: [0.22, 1, 0.36, 1] } as const;

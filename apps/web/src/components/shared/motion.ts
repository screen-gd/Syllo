/** Dialog and scrim enter: strong ease-out, 200ms. */
export const ENTER = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const;

/** Dialog and scrim exit: same curve, faster so closing never feels slow. */
export const EXIT = { duration: 0.15, ease: [0.23, 1, 0.32, 1] } as const;

/** Side panels sliding from an edge: iOS-like drawer curve. */
export const DRAWER = { duration: 0.3, ease: [0.32, 0.72, 0, 1] } as const;

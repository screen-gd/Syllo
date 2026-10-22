export const FREE_GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
] as const;

/** A free-only deployment never falls back to a billable provider or model. */
export function assertFreeAi(provider: string, model: string) {
    if (
        provider !== "gemini" ||
        !FREE_GEMINI_MODELS.some((allowed) => allowed === model)
    ) {
        throw new Error(
            "Syllo is configured for free Gemini models only. Choose Gemini Flash or Flash-Lite with a key from an unbilled Google AI Studio project.",
        );
    }
}

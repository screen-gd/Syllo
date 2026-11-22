/**
 * Wording for reading Scout packs with a coding agent installed on this
 * computer instead of a Gemini key. The Scout form reads the field text and
 * the routes and runner read the errors, so both sides stay in step.
 */
export const AGENT_COPY = {
    readerLabel: "Read videos with",
    readerCaption: "Installed agents use your own subscription and need no key, while the Gemini API key option is free.",
    readerGemini: "Gemini API key",
    startNoteGemini: "Uses free Gemini allowances. No paid fallback.",
    startNoteAgent: (agent: string) => `Scout reads with ${agent} on your own subscription. No Gemini key needed.`,
    needsReader: "Scout needs a way to read videos. Add a Gemini API key or pick an installed agent, then try again.",
    agentMissing: (agent: string) => `Scout could not find or start ${agent} on this computer. Check that it is installed, or pick another option.`,
    agentFailed: (agent: string, detail: string) => `${agent} stopped with an error while reading for Scout. Try again or pick another option. Reason: ${detail}`,
    agentTimeout: (agent: string, seconds: number) => `${agent} did not answer after ${seconds} seconds, so Scout stopped waiting. Try again or pick another option.`,
    agentBadAnswer: (agent: string) => `${agent} replied twice in a format Scout cannot use. Try again or pick another option.`,
};

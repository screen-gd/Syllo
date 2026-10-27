import extractRaw from "../../../prompts/scout/extract.v2.md?raw";
import planRaw from "../../../prompts/scout/plan.v2.md?raw";
import quizRaw from "../../../prompts/scout/quiz.v1.md?raw";
import bookRaw from "../../../prompts/scout/book.v1.md?raw";

export interface ScoutPrompt {
    version: number;
    purpose: string;
    body: string;
}

function parsePrompt(raw: string): ScoutPrompt {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { version: 1, purpose: "", body: raw.trim() };

    const frontmatter = match[1];
    const read = (key: string) => frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";

    return {
        version: Number(read("version")) || 1,
        purpose: read("purpose"),
        body: match[2].trim(),
    };
}

/**
 * Prompts live in prompts/scout/*.vN.md so a change is reviewable in a diff.
 * Bump the filename when the contract changes.
 */
export const SCOUT_PROMPTS = {
    extract: parsePrompt(extractRaw),
    plan: parsePrompt(planRaw),
    quiz: parsePrompt(quizRaw),
    book: parsePrompt(bookRaw),
} as const;

export const SCOUT_PROMPT_VERSION = [
    `extract.v${SCOUT_PROMPTS.extract.version}`,
    `plan.v${SCOUT_PROMPTS.plan.version}`,
    `quiz.v${SCOUT_PROMPTS.quiz.version}`,
].join("+");

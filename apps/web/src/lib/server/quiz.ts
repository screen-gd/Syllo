import type { AIProvider } from "@/lib/ai-config";
import type { ModuleSection, Roadmap } from "@/types";
import { generateStructuredJson } from "@/lib/server/ai";
import { deductCredits } from "@/lib/server/credits";

function getGlossaryTerms(roadmap: Roadmap) {
    return roadmap.sections
        .filter((section) => section.type === "glossary")
        .flatMap((section) => section.data.map((term) => `${term.term}: ${term.definition}`));
}

function collectQuizSource(roadmap: Roadmap, section: ModuleSection) {
    const glossary = getGlossaryTerms(roadmap).slice(0, 12).join("\n");
    const tasks = section.data.tasks
        .map((task) => `${task.title}${task.description ? ` - ${task.description}` : ""}`)
        .join("\n");

    return [section.data.description, section.data.notes ?? "", glossary, tasks]
        .filter(Boolean)
        .join("\n\n");
}

export async function generateQuiz(options: {
    roadmap: Roadmap;
    sectionId: string;
    userApiKey?: string;
    userModel?: string;
    userProvider?: AIProvider;
}) {
    const section = options.roadmap.sections.find((candidate) => candidate.id === options.sectionId && candidate.type === "module");
    if (!section || section.type !== "module") {
        throw new Error("Module section not found");
    }

    const source = collectQuizSource(options.roadmap, section);
    if (!source.trim()) {
        throw new Error("Not enough module material to generate a quiz");
    }

    const creditResult = await deductCredits({
        kind: "quiz",
        userApiKey: options.userApiKey,
        metadata: {
            roadmapId: options.roadmap.id,
            sectionId: section.id,
        },
    });

    if (creditResult.reason === "insufficient") {
        return { success: false, error: "insufficient_credits", creditStatus: creditResult.status };
    }

    const prompt = `
Return only valid JSON with this shape:
{
  "questions": [
    {
      "id": "q1",
      "prompt": "string",
      "choices": ["a", "b", "c", "d"],
      "answerIndex": 0,
      "explanation": "string"
    }
  ]
}

Create 5 multiple-choice questions using only the module material below.

Module title: ${section.title}
Module content:
${source}
`;

    const payload = await generateStructuredJson(prompt, {
        apiKey: options.userApiKey,
        model: options.userModel,
        provider: options.userProvider,
    });
    const parsed = JSON.parse(payload) as { questions?: Array<Record<string, unknown>> };

    return {
        success: true,
        creditStatus: creditResult.status,
        quiz: {
            sectionId: section.id,
            title: `${section.title} Quiz`,
            questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        },
    };
}

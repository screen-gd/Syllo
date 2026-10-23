import type { AIProvider } from "@/lib/ai-config";
import type { CoachingSession } from "@/types";
import { generateStructuredJson } from "@/lib/server/ai";
import { deductCredits } from "@/lib/server/credits";
import { listStoredCoachingSessions, pushStoredCoachingSession } from "@/lib/server/store";
import { listUserWorkspaces } from "@/lib/server/workspaces";

export async function saveCoachingSession(input: {
    roadmapId: string;
    date: string;
    durationMinutes: number;
    topics: string[];
    nextSteps: string;
}) {
    const session: CoachingSession = {
        id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        roadmapId: input.roadmapId,
        date: input.date,
        durationMinutes: input.durationMinutes,
        topics: input.topics,
        nextSteps: input.nextSteps,
    };

    pushStoredCoachingSession(session);
    return session;
}

export async function generateNinetyDayReview(input: {
    roadmapId: string;
    userApiKey?: string;
    userModel?: string;
    userProvider?: AIProvider;
}) {
    const roadmaps = await listUserWorkspaces();
    const roadmap = roadmaps.find((candidate) => candidate.id === input.roadmapId);
    if (!roadmap) {
        throw new Error("Roadmap not found");
    }

    const sessions = listStoredCoachingSessions(roadmap.id).slice(0, 12);

    const creditResult = await deductCredits({
        kind: "review",
        userApiKey: input.userApiKey,
        metadata: { roadmapId: roadmap.id },
    });

    if (creditResult.reason === "insufficient") {
        return { success: false, error: "insufficient_credits", creditStatus: creditResult.status };
    }

    const prompt = `
Return only valid JSON with this shape:
{
  "summary": "string",
  "strengths": ["string"],
  "risks": ["string"],
  "nextActions": ["string"]
}

Create a concise 90-day review for this roadmap:
Title: ${roadmap.title}
Mode: ${roadmap.mode}
Summary: ${roadmap.summary ?? ""}
Recent coaching sessions:
${JSON.stringify(sessions ?? [])}
`;

    const payload = await generateStructuredJson(prompt, {
        apiKey: input.userApiKey,
        model: input.userModel,
        provider: input.userProvider,
    });
    return {
        success: true,
        creditStatus: creditResult.status,
        review: JSON.parse(payload),
    };
}

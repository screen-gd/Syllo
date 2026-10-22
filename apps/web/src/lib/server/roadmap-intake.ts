import { deductCredits } from "@/lib/server/credits";
import { generateStructuredJson, testAiConnection } from "@/lib/server/ai";
import { getAiProviderInvalidKeyMessage, isAiProvider } from "@/lib/ai-config";
import { truncateForAi } from "@/lib/openai";

const SYSTEM_PROMPT = `You are an advanced Context-Aware AI that transforms raw content into a structured, highly organized digital workspace.
Instead of treating everything as a generic "roadmap", you MUST first dynamically detect the content type and adapt the entire structure accordingly.

STEP 1: CONTEXT DETECTION
Read the entire content and classify it into one of the following content types:
- "roadmap" (e.g., career paths, long-term skill acquisition)
- "playbook" (e.g., social media strategies, operational guidelines)
- "guide" (e.g., comprehensive "how-to" documentation)
- "curriculum" (e.g., course syllabi, module-based learning)
- "strategy" (e.g., business goals, strategic plans, OKRs)
- "tutorial" (e.g., step-by-step technical guides)
- "reference" (e.g., documentation, glossaries, encyclopedic content)
- "plan" (e.g., project plans, execution outlines)
- "checklist" (e.g., simple actionable lists)
- "other"

STEP 2: SECTION GENERATION RULES
- REMOVE ALL default/generic section structures. Do NOT blindly create a generic structure.
- Decide which sections and structures make the most sense based entirely on the detected content type.
  * A roadmap -> phases, milestones, timeline, tasks per phase.
  * A playbook -> strategies, platform-specific sections, tactics, content calendar.
  * A curriculum -> modules, lessons, objectives, assessments.
  * A strategy -> goals, initiatives, KPIs, action items.
- Section titles MUST reflect the actual content, not boilerplate text.
- Use the "module" section type for most rich parent sections (phases, strategies, modules, goals, etc.) because it is the most capable container.
- Use the "milestones" section type if the content specifically calls for sequential sequential milestone tracking.
- For a "module" or "milestones" section, place ALL relevant tasks, resources, and videos directly INSIDE that section's data. Do NOT strip them out into global sections unless they are truly global.
- Extract nested details: Look deeply into the text to extract specific tools, platforms, websites, and YouTube links and put them in the corresponding "videos" or "resources" array of their related section.

STEP 3: JSON OUTPUT SCHEMA
Return ONLY valid JSON (no markdown wrapping, no explanations). Use this exact shape:

{
  "title": "string - inferred from content if not provided",
  "summary": "1-3 sentence summary of overall goals and what the content covers",
  "contentType": "string - the detected type from Step 1 (roadmap|playbook|curriculum|etc)",
  "detectedContext": "One sentence describing what the content is about",
  "totalEstimatedDuration": "e.g. 12 hours or 3 weeks",
  "difficulty": "beginner|intermediate|advanced",
  "goal": "What the user will achieve by completing this",
  "mode": "general|intern",
  "sections": [
    {
      "id": "unique-id",
      "type": "module|milestones|tasks|progress|resources|videos|calendar|notes|glossary|submissions|custom",
      "title": "Section Title (e.g., Phase 1: Foundation, Strategy: Organic Growth)",
      "order": 0,
      "metadata": {
        "estimatedDuration": "2 hours",
        "difficulty": "beginner|intermediate|advanced",
        "taskCount": 5,
        "keyOutcome": "One sentence — what the learner will be able to do after this module"
      },
      "data": <section-specific data object>
    }
  ]
}

Section "data" Shapes:
- type "module": {"description": "...", "estimatedTime": "...", "concepts": "key points", "objectives": ["..."], "tasks": [{"id":"...","text":"...","description":"...","estimatedTime":"~30 mins","priority":"core|optional|advanced","done":false,"notes":"","subtasks":[{"id":"...","title":"...","completed":false}],"attachments":[]}], "resources": [{"id":"...","title":"...","url":"...", "type":"video|doc|pdf|link|code|tool|course|book", "description":"..."}], "videos": [{"id":"...","title":"...","url":"...","videoId":"...","platform":"youtube|vimeo|other","description":"...", "duration": "...", "timestamps": [{"time": "...", "label": "..."}]}], "completed": false}
- type "milestones": [{"id":"...","title":"...","description":"...","tasks":[...],"resources":[...],"videos":[...],"completed":false,"order":0}]
- type "tasks": [{"id":"...","title":"...","tasks":[...]}]
- type "resources": [{"id":"...","title":"...","url":"...","type":"...","description":"..."}]
- type "videos": [{"id":"...","title":"...","url":"...","videoId":"...","platform":"youtube|vimeo|other","description":"..."}]
- type "calendar": [{"id":"...","title":"...","date":"ISO date","description":"...","completed":false}]
- type "notes": []
- type "progress": {}
- type "glossary": [{"id":"...","term":"...","definition":"...","relatedSections":[]}]
- type "submissions": []
- type "custom": {"description":"...","layout":"checklist|cards|table|list","items":[{"id":"...","title":"...","description":"...","completed":false,"metadata":{}}]}

CRITICAL RULES FOR EXTRACTION:
- Every phase, module, strategy, or overarching topic should be represented as a rich "module" or "milestones" section so that content isn't fragmented.
- Extract tool names (e.g., Notion, Figma, VSCode), websites, and video links (youtube.com/...) into the resources/videos arrays for the specific section where they belong.
- Ensure the API response is ONLY a single parseable JSON object.
`;

const VALID_SECTION_TYPES = new Set([
    "module",
    "milestones",
    "tasks",
    "progress",
    "resources",
    "videos",
    "calendar",
    "notes",
    "glossary",
    "submissions",
    "custom",
]);

const VALID_RESOURCE_TYPES = new Set(["video", "doc", "pdf", "link", "code", "tool", "course", "book"]);
const VALID_VIDEO_PLATFORMS = new Set(["youtube", "vimeo", "other"]);
const VALID_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"]);
const VALID_LAYOUTS = new Set(["checklist", "cards", "table", "list"]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function toId(value: unknown): string {
    if (typeof value === "string" && value.trim().length > 0) return value;
    return `id-${Math.random().toString(36).slice(2, 10)}`;
}

function toDifficulty(value: unknown): "beginner" | "intermediate" | "advanced" {
    return VALID_DIFFICULTIES.has(value as string) ? (value as "beginner" | "intermediate" | "advanced") : "beginner";
}

function normalizeSubtasks(value: unknown): Array<{ id: string; title: string; completed: boolean }> {
    if (!Array.isArray(value)) return [];

    return value
        .filter(isRecord)
        .map((subtask) => ({
            id: toId(subtask.id),
            title: asString(subtask.title, "Untitled subtask"),
            completed: asBoolean(subtask.completed, false),
        }));
}

function normalizeTask(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) {
        return {
            id: toId(undefined),
            title: "Untitled task",
            completed: false,
            notes: "",
            subtasks: [],
            attachments: [],
        };
    }

    const title = asString(value.title) || asString(value.text) || "Untitled task";
    const completed = typeof value.completed === "boolean" ? value.completed : asBoolean(value.done, false);
    const attachments = Array.isArray(value.attachments) ? value.attachments.filter(isRecord) : [];

    return {
        ...value,
        id: toId(value.id),
        title,
        text: asString(value.text, title),
        completed,
        done: completed,
        notes: asString(value.notes),
        subtasks: normalizeSubtasks(value.subtasks),
        attachments,
    };
}

function normalizeResource(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) {
        return {
            id: toId(undefined),
            title: "Untitled resource",
            url: "",
            type: "link",
            description: "",
        };
    }

    const type = VALID_RESOURCE_TYPES.has(value.type as string) ? value.type : "link";
    return {
        ...value,
        id: toId(value.id),
        title: asString(value.title, "Untitled resource"),
        url: asString(value.url),
        type,
        description: asString(value.description),
    };
}

function normalizeVideo(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) {
        return {
            id: toId(undefined),
            title: "Untitled video",
            url: "",
            videoId: "",
            platform: "other",
            description: "",
        };
    }

    const platform = VALID_VIDEO_PLATFORMS.has(value.platform as string) ? value.platform : "other";
    const timestamps = Array.isArray(value.timestamps)
        ? value.timestamps.filter(isRecord).map((ts) => ({
            time: asString(ts.time),
            label: asString(ts.label),
        }))
        : [];

    return {
        ...value,
        id: toId(value.id),
        title: asString(value.title, "Untitled video"),
        url: asString(value.url),
        videoId: asString(value.videoId),
        platform,
        description: asString(value.description),
        duration: asString(value.duration),
        timestamps,
    };
}

function normalizeModuleData(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) {
        return {
            description: "",
            estimatedTime: "",
            concepts: "",
            objectives: [],
            tasks: [],
            resources: [],
            videos: [],
            completed: false,
        };
    }

    return {
        description: asString(value.description),
        estimatedTime: asString(value.estimatedTime),
        concepts: asString(value.concepts),
        objectives: Array.isArray(value.objectives) ? value.objectives.filter((v): v is string => typeof v === "string") : [],
        tasks: Array.isArray(value.tasks) ? value.tasks.map(normalizeTask) : [],
        resources: Array.isArray(value.resources) ? value.resources.map(normalizeResource) : [],
        videos: Array.isArray(value.videos) ? value.videos.map(normalizeVideo) : [],
        completed: asBoolean(value.completed, false),
    };
}

function normalizeSection(section: unknown, index: number): Record<string, unknown> | null {
    if (!isRecord(section)) return null;
    if (!VALID_SECTION_TYPES.has(section.type as string)) return null;

    const type = section.type as string;
    const metadata = isRecord(section.metadata)
        ? {
            estimatedDuration: asString(section.metadata.estimatedDuration),
            difficulty: asString(section.metadata.difficulty),
            taskCount: typeof section.metadata.taskCount === "number" ? section.metadata.taskCount : undefined,
            keyOutcome: asString(section.metadata.keyOutcome),
        }
        : undefined;

    const normalized: Record<string, unknown> = {
        id: toId(section.id),
        type,
        title: asString(section.title, `Section ${index + 1}`),
        order: typeof section.order === "number" ? section.order : index,
    };
    if (metadata) normalized.metadata = metadata;

    if (type === "module") {
        normalized.data = normalizeModuleData(section.data);
        return normalized;
    }

    if (type === "milestones") {
        const milestones = Array.isArray(section.data) ? section.data : [];
        normalized.data = milestones.filter(isRecord).map((milestone, milestoneIndex) => ({
            id: toId(milestone.id),
            title: asString(milestone.title, `Milestone ${milestoneIndex + 1}`),
            description: asString(milestone.description),
            tasks: Array.isArray(milestone.tasks) ? milestone.tasks.map(normalizeTask) : [],
            resources: Array.isArray(milestone.resources) ? milestone.resources.map(normalizeResource) : [],
            videos: Array.isArray(milestone.videos) ? milestone.videos.map(normalizeVideo) : [],
            completed: asBoolean(milestone.completed, false),
            order: typeof milestone.order === "number" ? milestone.order : milestoneIndex,
        }));
        return normalized;
    }

    if (type === "tasks") {
        const groups = Array.isArray(section.data) ? section.data : [];
        normalized.data = groups.filter(isRecord).map((group, groupIndex) => ({
            id: toId(group.id),
            title: asString(group.title, `Task Group ${groupIndex + 1}`),
            tasks: Array.isArray(group.tasks) ? group.tasks.map(normalizeTask) : [],
        }));
        return normalized;
    }

    if (type === "resources") {
        normalized.data = Array.isArray(section.data) ? section.data.map(normalizeResource) : [];
        return normalized;
    }

    if (type === "videos") {
        normalized.data = Array.isArray(section.data) ? section.data.map(normalizeVideo) : [];
        return normalized;
    }

    if (type === "calendar") {
        const events = Array.isArray(section.data) ? section.data : [];
        normalized.data = events.filter(isRecord).map((event) => ({
            id: toId(event.id),
            title: asString(event.title, "Calendar Event"),
            date: asString(event.date),
            description: asString(event.description),
            completed: asBoolean(event.completed, false),
        }));
        return normalized;
    }

    if (type === "glossary") {
        const terms = Array.isArray(section.data) ? section.data : [];
        normalized.data = terms.filter(isRecord).map((term) => ({
            id: toId(term.id),
            term: asString(term.term),
            definition: asString(term.definition),
            relatedSections: Array.isArray(term.relatedSections)
                ? term.relatedSections.filter((v): v is string => typeof v === "string")
                : [],
        }));
        return normalized;
    }

    if (type === "custom") {
        const data = isRecord(section.data) ? section.data : {};
        normalized.data = {
            description: asString(data.description),
            layout: VALID_LAYOUTS.has(data.layout as string) ? data.layout : "list",
            items: Array.isArray(data.items)
                ? data.items.filter(isRecord).map((item) => ({
                    id: toId(item.id),
                    title: asString(item.title, "Untitled item"),
                    description: asString(item.description),
                    completed: asBoolean(item.completed, false),
                    metadata: isRecord(item.metadata) ? item.metadata : {},
                }))
                : [],
        };
        return normalized;
    }

    if (type === "progress") {
        normalized.data = {};
        return normalized;
    }

    normalized.data = Array.isArray(section.data) ? section.data : [];
    return normalized;
}

export function normalizeRoadmapPayload(parsed: unknown, fallback: { title?: string; mode?: string; goal?: string; difficulty?: string; estimatedDuration?: string }) {
    if (!isRecord(parsed)) return null;
    const sectionsInput = Array.isArray(parsed.sections) ? parsed.sections : [];
    const sections = sectionsInput.map(normalizeSection).filter((section): section is Record<string, unknown> => Boolean(section));
    if (sections.length === 0) return null;

    const mode = parsed.mode === "intern" || fallback.mode === "intern" ? "intern" : "general";
    return {
        title: asString(parsed.title, fallback.title || "Untitled Course"),
        summary: asString(parsed.summary),
        contentType: asString(parsed.contentType, "other"),
        detectedContext: asString(parsed.detectedContext),
        totalEstimatedDuration: asString(parsed.totalEstimatedDuration, fallback.estimatedDuration || ""),
        difficulty: toDifficulty(parsed.difficulty ?? fallback.difficulty),
        goal: asString(parsed.goal, fallback.goal || ""),
        mode,
        sections,
    };
}

function isInvalidKeyError(error: unknown) {
    const errMsg = String((error as { message?: string } | undefined)?.message || "").toLowerCase();
    return (
        errMsg.includes("401") ||
        errMsg.includes("403") ||
        errMsg.includes("unauthorized") ||
        errMsg.includes("forbidden") ||
        errMsg.includes("invalid") ||
        errMsg.includes("api key") ||
        errMsg.includes("permission")
    );
}

export async function handleRoadmapIntake(req: Request) {
    try {
        const body = await req.json();
        const { content, mode, title, goal, difficulty, estimatedDuration, userApiKey, userProvider, userModel, testOnly } = body;

        if (!content || typeof content !== "string") {
            return Response.json(
                { success: false, error: "Content is required" },
                { status: 400 }
            );
        }

        const sanitizedUserKey = typeof userApiKey === "string" ? userApiKey.trim() : "";
        const sanitizedProvider = isAiProvider(userProvider) ? userProvider : "gemini";
        const sanitizedModel = typeof userModel === "string" && userModel.trim().length > 0 ? userModel.trim() : undefined;
        const useUserKey = Boolean(sanitizedUserKey);

        if (testOnly) {
            try {
                await testAiConnection(
                    useUserKey
                        ? {
                            apiKey: sanitizedUserKey,
                            model: sanitizedModel,
                            provider: sanitizedProvider,
                        }
                        : undefined,
                );
                return Response.json({ success: true, ok: true });
            } catch (aiError) {
                if (isInvalidKeyError(aiError)) {
                    return Response.json(
                        { success: false, error: "invalid_key", message: getAiProviderInvalidKeyMessage(sanitizedProvider) },
                        { status: 401 }
                    );
                }
                return Response.json(
                    {
                        success: false,
                        error: "provider_error",
                        message: (aiError as { message?: string } | undefined)?.message || "Provider connection failed",
                    },
                    { status: 502 }
                );
            }
        }

        if (!useUserKey) {
            const creditResult = await deductCredits({
                kind: "workspace_generation",
                userApiKey: undefined,
                metadata: {
                    mode: mode === "intern" ? "intern" : "general",
                },
            });

            if (!creditResult.charged && creditResult.reason === "insufficient") {
                return Response.json(
                    {
                        error: "limit_reached",
                        plan: creditResult.status.planId,
                        message: `You have ${creditResult.status.remaining} credits remaining. Workspace generation costs 10 credits. Add your own provider key or upgrade for a higher allowance.`,
                    },
                    { status: 403 }
                );
            }
        }

        let extraContext = "";
        if (goal) extraContext += `User Goal: ${goal}\n`;
        if (difficulty) extraContext += `Target Difficulty: ${difficulty}\n`;
        if (estimatedDuration) extraContext += `Estimated Duration: ${estimatedDuration}\n`;

        const fullPrompt = `${SYSTEM_PROMPT}\n\n${title ? `Title: ${title}\n` : ""}Mode: ${mode || "general"}\n${extraContext}Content:\n${truncateForAi(content)}`;
        
        let rawContent;
        try {
            rawContent = await generateStructuredJson(
                fullPrompt,
                useUserKey
                    ? {
                        apiKey: sanitizedUserKey,
                        model: sanitizedModel,
                        provider: sanitizedProvider,
                    }
                    : undefined,
            );
        } catch (aiError) {
            if (isInvalidKeyError(aiError)) {
                return Response.json(
                    { success: false, error: "invalid_key", message: getAiProviderInvalidKeyMessage(sanitizedProvider) },
                    { status: 401 }
                );
            }
            throw aiError;
        }

        if (!rawContent) {
            return Response.json(
                { success: false, error: "AI returned an empty or invalid response structure" },
                { status: 500 }
            );
        }

        // Parse JSON from the AI response (handle potential code fences)
        let parsed;
        try {
            const cleaned = rawContent.replace(/^```(json)?\n?/i, "").replace(/\n?```$/g, "").trim();
            parsed = JSON.parse(cleaned);
        } catch (parseError) {
            console.error("Failed to parse AI JSON:", rawContent, parseError);
            return Response.json(
                { success: false, error: "AI response was not valid JSON" },
                { status: 500 }
            );
        }

        const normalized = normalizeRoadmapPayload(parsed, { title, mode, goal, difficulty, estimatedDuration });
        if (!normalized) {
            return Response.json(
                { success: false, error: "AI response did not match the roadmap schema" },
                { status: 500 }
            );
        }

        return Response.json({ success: true, roadmap: normalized });
    } catch (err) {
        console.error("Parse roadmap error:", err);
        return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

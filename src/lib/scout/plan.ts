import { z } from "zod";
import type {
    ModuleSection,
    Note,
    NoteSection,
    Resource,
    ResourceSection,
    Roadmap,
    SrsItem,
    Task,
    Video,
} from "@/types";
import { clip, deepLink, formatTimestamp, quoteAppearsIn } from "./format";
import { scoutGenerateObject } from "./llm";
import { SCOUT_PROMPTS, SCOUT_PROMPT_VERSION } from "./prompts";
import type { ScoutResource } from "./types";

const planSchema = z.object({
    title: z.string(),
    summary: z.string(),
    objectives: z.array(z.string()).default([]),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
    modules: z
        .array(
            z.object({
                title: z.string(),
                description: z.string().default(""),
                skill: z.string().default(""),
                tasks: z
                    .array(
                        z.object({
                            title: z.string(),
                            resourceId: z.string(),
                            startSeconds: z.number().nullable().optional(),
                            endSeconds: z.number().nullable().optional(),
                            estimatedMinutes: z.number().nullable().optional(),
                        }),
                    )
                    .default([]),
            }),
        )
        .default([]),
});

export type ScoutPlan = z.infer<typeof planSchema>;

type PlanTask = ScoutPlan["modules"][number]["tasks"][number];
type PlanModuleInput = ScoutPlan["modules"][number];

const quizSchema = z.object({
    cards: z
        .array(
            z.object({
                moduleIndex: z.number(),
                resourceId: z.string(),
                prompt: z.string(),
                answer: z.string(),
                atSeconds: z.number().nullable().optional(),
                quote: z.string(),
            }),
        )
        .default([]),
});

type ScoutQuizPlan = z.infer<typeof quizSchema>;

interface PlanModule {
    title: string;
    description: string;
    skill: string;
    resourceIds: string[];
    tasks: Array<{
        title: string;
        resourceId: string;
        startSeconds: number | null;
        endSeconds: number | null;
        estimatedMinutes: number | null;
    }>;
}

export interface BuiltWorkspace {
    roadmap: Roadmap;
    quizzes: SrsItem[];
    degraded: boolean;
}

export interface BuildWorkspaceInput {
    packId: string;
    goal: string;
    resources: ScoutResource[];
    config?: Parameters<typeof scoutGenerateObject>[0]["config"];
}

function unique<T>(values: T[]): T[] {
    return [...new Set(values)];
}

function resourceMap(resources: ScoutResource[]) {
    return new Map(resources.map((resource) => [resource.id, resource]));
}

function taskMinutes(resource: ScoutResource, startSeconds: number | null, endSeconds: number | null) {
    if (resource.kind === "video" && startSeconds !== null && endSeconds !== null && endSeconds > startSeconds) {
        return Math.max(2, Math.round((endSeconds - startSeconds) / 60));
    }
    if (resource.kind === "book") return 45;
    if (resource.kind === "article" || resource.kind === "doc") return 20;
    return 15;
}

function chapterFor(resource: ScoutResource, startSeconds: number | null) {
    if (startSeconds === null) return null;
    return resource.chapters.find((chapter) => chapter.startSeconds === startSeconds) ?? null;
}

function attachment(resource: ScoutResource, startSeconds: number | null): Resource | null {
    if (resource.kind === "book") return null;

    const url =
        resource.kind === "video" && resource.externalId && startSeconds
            ? deepLink(resource.externalId, startSeconds)
            : resource.url;

    const type: Resource["type"] =
        resource.kind === "video" ? "video" : resource.kind === "doc" ? "doc" : "link";

    return {
        id: `link_${resource.id}_${startSeconds ?? 0}`,
        title: resource.title,
        url,
        type,
        description: resource.summary ?? resource.description ?? "",
    };
}

function taskNotes(resource: ScoutResource, startSeconds: number | null, endSeconds: number | null) {
    const lines: string[] = [];
    if (resource.summary) lines.push(resource.summary);

    const relevant = resource.keyPoints
        .filter((point) => {
            if (point.atSeconds == null) return true;
            if (startSeconds === null) return true;
            return point.atSeconds >= startSeconds && (endSeconds === null || point.atSeconds <= endSeconds);
        })
        .slice(0, 4);

    for (const point of relevant) {
        const link =
            resource.kind === "video" && resource.externalId && point.atSeconds != null
                ? `[${formatTimestamp(point.atSeconds)}](${deepLink(resource.externalId, point.atSeconds)})`
                : point.atSeconds != null
                  ? formatTimestamp(point.atSeconds)
                  : "";
        lines.push(`- ${link ? `${link} — ` : ""}${point.text}`);
        if (point.quote) lines.push(`  > ${point.quote}`);
    }

    return lines.join("\n").slice(0, 2000);
}

function videoFor(resource: ScoutResource): Video | null {
    if (resource.kind !== "video" || !resource.externalId) return null;
    return {
        id: `video_${resource.id}`,
        title: resource.title,
        url: resource.url,
        videoId: resource.externalId,
        platform: "youtube",
        description: resource.summary ?? "",
        duration: resource.durationSeconds ? `${Math.round(resource.durationSeconds / 60)} min` : undefined,
        timestamps: resource.chapters.slice(0, 20).map((chapter) => ({
            time: formatTimestamp(chapter.startSeconds),
            label: chapter.title,
        })),
    };
}

function taskTitle(
    resource: ScoutResource,
    verb: "Watch" | "Read",
    startSeconds: number | null,
    endSeconds: number | null,
    proposed?: string,
) {
    const chapter = chapterFor(resource, startSeconds);

    if (verb === "Watch" && startSeconds !== null && endSeconds !== null) {
        const label = chapter?.title ?? proposed ?? resource.title;
        return `Watch ${label} (${formatTimestamp(startSeconds)}–${formatTimestamp(endSeconds)})`;
    }

    if (verb === "Watch" && startSeconds !== null) {
        const label = chapter?.title ?? proposed ?? resource.title;
        return `Watch ${label} from ${formatTimestamp(startSeconds)}`;
    }

    return proposed || `${verb} ${resource.title}`;
}

function buildTask(input: {
    packId: string;
    moduleIndex: number;
    taskIndex: number;
    resource: ScoutResource;
    verb: "Watch" | "Read";
    startSeconds: number | null;
    endSeconds: number | null;
    title?: string;
    estimatedMinutes?: number | null;
}) {
    const { resource, startSeconds, endSeconds } = input;
    const link = attachment(resource, startSeconds);
    const minutes = input.estimatedMinutes ?? taskMinutes(resource, startSeconds, endSeconds);

    const task: Task = {
        id: `task_${input.packId}_${input.moduleIndex}_${input.taskIndex}`,
        title: taskTitle(resource, input.verb, startSeconds, endSeconds, input.title),
        completed: false,
        notes: taskNotes(resource, startSeconds, endSeconds),
        subtasks: [],
        attachments: link ? [link] : [],
        estimatedTime: `${Math.max(2, Math.min(300, Math.round(minutes)))} min`,
        priority: "core",
    };

    return task;
}

function fallbackPlan(goal: string, resources: ScoutResource[]): ScoutPlan {
    const groups = new Map<string, ScoutResource[]>();
    for (const resource of resources) {
        const label =
            resource.skillTags[0] ??
            (resource.kind === "book" ? "Reading" : resource.kind === "video" ? "Watch" : "Read");
        const key = label.charAt(0).toUpperCase() + label.slice(1);
        groups.set(key, [...(groups.get(key) ?? []), resource]);
    }

    const modules: PlanModuleInput[] = [...groups.entries()].slice(0, 5).map(([skill, items]): PlanModuleInput => ({
        title: skill,
        description: `Work through ${items.length} free resource${items.length === 1 ? "" : "s"} on ${skill.toLowerCase()}.`,
        skill,
        tasks: items.flatMap((resource): PlanTask[] => {
            if (resource.kind === "book") {
                const chapters = resource.chapters.length > 0 ? resource.chapters : [{ title: resource.title, startSeconds: 0, url: resource.url }];
                return chapters.slice(0, 10).map((chapter) => ({
                    title: `Read ${chapter.title}`,
                    resourceId: resource.id,
                    startSeconds: null,
                    endSeconds: null,
                    estimatedMinutes: 45,
                }));
            }
            if (resource.kind === "video") {
                if (resource.chapters.length > 0) {
                    return resource.chapters.slice(0, 10).map((chapter) => ({
                        title: `Watch ${chapter.title}`,
                        resourceId: resource.id,
                        startSeconds: chapter.startSeconds,
                        endSeconds: chapter.endSeconds ?? null,
                        estimatedMinutes: taskMinutes(resource, chapter.startSeconds, chapter.endSeconds ?? null),
                    }));
                }
                return [
                    {
                        title: `Watch ${resource.title}`,
                        resourceId: resource.id,
                        startSeconds: null,
                        endSeconds: null,
                        estimatedMinutes: taskMinutes(resource, null, null),
                    },
                ];
            }
            return [
                {
                    title: `Read ${resource.title}`,
                    resourceId: resource.id,
                    startSeconds: null,
                    endSeconds: null,
                    estimatedMinutes: taskMinutes(resource, null, null),
                },
            ];
        }),
    }));

    const skills = unique(resources.flatMap((resource) => resource.skillTags)).slice(0, 4);

    return {
        title: goal || "Your Scout workspace",
        summary: `A practical path through ${resources.length} free resources chosen for "${goal}".`,
        objectives: skills.map((skill) => `Practise ${skill} on a real project`),
        difficulty: "intermediate",
        modules,
    };
}

function normalizeModules(plan: ScoutPlan, resources: ScoutResource[]): PlanModule[] {
    const byId = resourceMap(resources);
    const seen = new Set<string>();
    const modules: PlanModule[] = [];

    for (const module of plan.modules.slice(0, 6)) {
        const tasks: PlanModule["tasks"] = [];
        const resourceIds: string[] = [];

        for (const task of module.tasks) {
            const resource = byId.get(task.resourceId);
            if (!resource) continue;

            const startSeconds =
                typeof task.startSeconds === "number" && Number.isFinite(task.startSeconds) && task.startSeconds >= 0
                    ? Math.floor(task.startSeconds)
                    : null;
            const duration = resource.durationSeconds ?? null;
            const endSeconds =
                typeof task.endSeconds === "number" && Number.isFinite(task.endSeconds) && task.endSeconds > (startSeconds ?? 0)
                    ? Math.min(Math.floor(task.endSeconds), duration ? duration + 30 : Number.MAX_SAFE_INTEGER)
                    : null;

            const key = `${resource.id}:${startSeconds ?? ""}`;
            if (seen.has(key)) continue;
            seen.add(key);

            tasks.push({
                title: clip(task.title, 140),
                resourceId: resource.id,
                startSeconds,
                endSeconds,
                estimatedMinutes: task.estimatedMinutes ?? null,
            });
            resourceIds.push(resource.id);
        }

        if (tasks.length === 0) continue;
        modules.push({
            title: clip(module.title || module.skill || "Module", 120),
            description: clip(module.description ?? "", 600),
            skill: module.skill ?? "",
            resourceIds: unique(resourceIds),
            tasks,
        });
    }

    // Every approved resource must appear somewhere, even when the model
    // forgot it. The appended module stays honest about why it exists.
    const missing = resources.filter((resource) => !seen.has(`${resource.id}:`));
    if (missing.length > 0) {
        modules.push({
            title: "Also included",
            description: "Resources from your approved picks that did not fit an earlier module.",
            skill: "Additional practice",
            resourceIds: missing.map((resource) => resource.id),
            tasks: missing.map((resource) => ({
                title: `${resource.kind === "video" ? "Watch" : "Read"} ${resource.title}`,
                resourceId: resource.id,
                startSeconds: null,
                endSeconds: null,
                estimatedMinutes: taskMinutes(resource, null, null),
            })),
        });
    }

    return modules;
}

function estimatedDuration(tasks: Task[]) {
    const minutes = tasks.reduce((total, task) => {
        const value = Number(task.estimatedTime?.replace(/[^0-9]/g, "") ?? 0);
        return total + (Number.isFinite(value) ? value : 0);
    }, 0);

    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function buildRoadmap(
    packId: string,
    goal: string,
    plan: ScoutPlan,
    modules: PlanModule[],
    resources: ScoutResource[],
): Roadmap {
    const byId = resourceMap(resources);
    const now = new Date().toISOString();
    const sections: Roadmap["sections"] = [];

    modules.forEach((module, moduleIndex) => {
        const moduleResources = module.resourceIds.map((id) => byId.get(id)).filter((item): item is ScoutResource => Boolean(item));
        const tasks: Task[] = [];

        module.tasks.forEach((task, taskIndex) => {
            const resource = byId.get(task.resourceId);
            if (!resource) return;
            tasks.push(
                buildTask({
                    packId,
                    moduleIndex,
                    taskIndex,
                    resource,
                    verb: resource.kind === "video" ? "Watch" : "Read",
                    startSeconds: task.startSeconds,
                    endSeconds: task.endSeconds,
                    title: task.title,
                    estimatedMinutes: task.estimatedMinutes,
                }),
            );
        });

        const videos = moduleResources.map(videoFor).filter((video): video is Video => Boolean(video));
        const links = moduleResources
            .map((resource) => attachment(resource, resource.kind === "video" ? (resource.chapters[0]?.startSeconds ?? null) : null))
            .filter((link): link is Resource => Boolean(link));

        const section: ModuleSection = {
            id: `sec_${packId}_m${moduleIndex}`,
            title: module.title,
            order: moduleIndex,
            type: "module",
            metadata: {
                estimatedDuration: estimatedDuration(tasks),
                taskCount: tasks.length,
                keyOutcome: module.skill || undefined,
            },
            data: {
                description: module.description,
                estimatedTime: estimatedDuration(tasks),
                concepts: moduleResources.flatMap((resource) => resource.skillTags).slice(0, 10).join(", "),
                objectives: module.skill ? [`Practise ${module.skill}`] : [],
                notes: module.skill,
                tasks,
                resources: links,
                videos,
                completed: false,
            },
        };

        sections.push(section);
    });

    const allTasks = sections.flatMap((section) => (section.type === "module" ? section.data.tasks : []));

    const notes: NoteSection = {
        id: `sec_${packId}_notes`,
        title: "Scout notes",
        order: sections.length,
        type: "notes",
        metadata: { taskCount: 0 },
        data: resources.map((resource, index) => {
            const body = [
                resource.summary ?? "",
                "",
                ...resource.keyPoints.slice(0, 5).map((point) => {
                    const stamp =
                        resource.kind === "video" && resource.externalId && point.atSeconds != null
                            ? `[${formatTimestamp(point.atSeconds)}](${deepLink(resource.externalId, point.atSeconds)}) — `
                            : "";
                    return `- ${stamp}${point.text}${point.quote ? `\n  > ${point.quote}` : ""}`;
                }),
            ]
                .join("\n")
                .trim();

            const note: Note = {
                id: `note_${packId}_${index}`,
                title: resource.title,
                content: body || "No notes were extracted for this resource.",
                createdAt: now,
                updatedAt: now,
            };
            return note;
        }),
    };
    sections.push(notes);

    const allLinks = resources
        .map((resource) =>
            attachment(resource, resource.kind === "video" ? (resource.chapters[0]?.startSeconds ?? null) : null),
        )
        .filter((link): link is Resource => Boolean(link));

    if (allLinks.length > 0) {
        const resourceSection: ResourceSection = {
            id: `sec_${packId}_resources`,
            title: "Resources",
            order: sections.length,
            type: "resources",
            metadata: { taskCount: 0 },
            data: allLinks,
        };
        sections.push(resourceSection);
    }

    const summary = clip(plan.summary, 900);
    const objectives = plan.objectives.map((objective) => clip(objective, 140)).filter(Boolean).slice(0, 6);

    return {
        id: `rm_${packId}`,
        title: clip(plan.title || goal, 140),
        mode: "general",
        summary,
        objectives,
        sections,
        rawContent: [
            `# ${plan.title || goal}`,
            "",
            summary,
            "",
            ...modules.map((module, index) => `## ${index + 1}. ${module.title}\n\n${module.description}`),
        ].join("\n"),
        createdAt: now,
        updatedAt: now,
        contentType: "curriculum",
        detectedContext: "scout",
        totalEstimatedDuration: estimatedDuration(allTasks),
        difficulty: plan.difficulty,
        goal,
        packVersion: `scout-${SCOUT_PROMPT_VERSION}`,
    };
}

function deterministicQuizzes(roadmapId: string, packId: string, modules: ModuleSection[], resources: ScoutResource[]): SrsItem[] {
    const byId = resourceMap(resources);
    const cards: SrsItem[] = [];
    const now = Date.now();

    for (const module of modules) {
        let moduleCards = 0;

        for (const resource of byId.values()) {
            if (moduleCards >= 2) break;
            if (!module.data.tasks.some((task) => task.attachments.some((link) => link.id.includes(resource.id)))) continue;

            for (const point of resource.keyPoints) {
                if (moduleCards >= 2) break;
                if (!point.quote || point.quote.length < 12) continue;

                cards.push({
                    id: `srs_${packId}_${cards.length}`,
                    roadmapId,
                    sectionId: module.id,
                    prompt: `In your own words: ${clip(point.text, 180)}`,
                    answer: point.quote,
                    easeFactor: 2.5,
                    intervalDays: 0,
                    repetitions: 0,
                    dueAt: new Date(now + (cards.length < 3 ? 0 : 24 * 3600_000)).toISOString(),
                    lastReviewedAt: null,
                });
                moduleCards += 1;
            }
        }
    }

    return cards;
}

function validateQuizCards(
    plan: ScoutQuizPlan,
    modules: ModuleSection[],
    resources: ScoutResource[],
    roadmapId: string,
): SrsItem[] {
    const byId = resourceMap(resources);
    const now = Date.now();
    const cards: SrsItem[] = [];

    for (const card of plan.cards) {
        const module = modules[card.moduleIndex];
        const resource = byId.get(card.resourceId);
        if (!module || !resource) continue;

        const quote = clip(card.quote, 400);
        if (quote.length < 12) continue;

        const source = [
            resource.summary ?? "",
            ...resource.keyPoints.map((point) => `${point.text} ${point.quote ?? ""}`),
            ...resource.chapters.map((chapter) => chapter.title),
        ].join("\n");

        if (!quoteAppearsIn(quote, source)) continue;

        const point = resource.keyPoints.find((item) => item.quote && quoteAppearsIn(quote, item.quote));
        const atSeconds =
            typeof card.atSeconds === "number" && Number.isFinite(card.atSeconds) && card.atSeconds >= 0
                ? Math.floor(card.atSeconds)
                : (point?.atSeconds ?? null);

        cards.push({
            id: `srs_${resource.id}_${cards.length}`,
            roadmapId,
            sectionId: module.id,
            prompt: clip(card.prompt, 240),
            answer: atSeconds === null ? clip(card.answer, 500) : `${clip(card.answer, 460)} — ${formatTimestamp(atSeconds)}`,
            easeFactor: 2.5,
            intervalDays: 0,
            repetitions: 0,
            dueAt: new Date(now + (cards.length < 3 ? 0 : 24 * 3600_000)).toISOString(),
            lastReviewedAt: null,
        });
    }

    return cards.slice(0, 12);
}

/**
 * Builds the roadmap and review cards from approved resources. The model gets
 * one shot; anything it returns is checked against the resources before it is
 * allowed into the workspace.
 */
export async function buildWorkspace(input: BuildWorkspaceInput): Promise<BuiltWorkspace> {
    const resources = input.resources.slice(0, 14);
    if (resources.length === 0) throw new Error("No approved resources to build from");

    const payload = {
        goal: input.goal,
        resources: resources.map((resource) => ({
            id: resource.id,
            title: resource.title,
            creator: resource.creator ?? null,
            kind: resource.kind,
            durationSeconds: resource.durationSeconds ?? null,
            summary: clip(resource.summary ?? "", 500),
            skills: resource.skillTags,
            chapters: resource.chapters.slice(0, 14).map((chapter) => ({
                title: chapter.title,
                startSeconds: chapter.startSeconds,
                endSeconds: chapter.endSeconds ?? null,
            })),
            keyPoints: resource.keyPoints.slice(0, 3).map((point) => ({
                text: point.text,
                atSeconds: point.atSeconds ?? null,
            })),
        })),
    };

    let plan: ScoutPlan;
    let degraded = false;

    try {
        const result = await scoutGenerateObject({
            packId: input.packId,
            schema: planSchema,
            system: SCOUT_PROMPTS.plan.body,
            prompt: JSON.stringify(payload),
            config: input.config,
        });
        plan = result.object;
    } catch (error) {
        console.warn("[scout] plan generation degraded:", error instanceof Error ? error.message : error);
        plan = fallbackPlan(input.goal, resources);
        degraded = true;
    }

    if (plan.modules.length === 0) {
        plan = fallbackPlan(input.goal, resources);
        degraded = true;
    }

    const modules = normalizeModules(plan, resources);
    const roadmap = buildRoadmap(input.packId, input.goal, plan, modules, resources);
    const moduleSections = roadmap.sections.filter((section): section is ModuleSection => section.type === "module");

    let quizzes: SrsItem[] = [];
    try {
        const moduleInput = moduleSections.map((section, index) => ({
            index,
            title: section.title,
            resources: unique(section.data.tasks.flatMap((task) => task.attachments.map((link) => link.title))).slice(0, 4),
            keyPoints: resources
                .filter((resource) => section.data.tasks.some((task) => task.attachments.some((link) => link.id.includes(resource.id))))
                .flatMap((resource) =>
                    resource.keyPoints
                        .filter((point) => point.quote)
                        .slice(0, 3)
                        .map((point) => ({
                            resourceId: resource.id,
                            text: point.text,
                            atSeconds: point.atSeconds ?? null,
                            quote: point.quote,
                        })),
                )
                .slice(0, 8),
        }));

        const result = await scoutGenerateObject({
            packId: input.packId,
            schema: quizSchema,
            system: SCOUT_PROMPTS.quiz.body,
            prompt: JSON.stringify({ goal: input.goal, modules: moduleInput }),
            config: input.config,
        });
        quizzes = validateQuizCards(result.object, moduleSections, resources, roadmap.id);
    } catch (error) {
        console.warn("[scout] quiz generation degraded:", error instanceof Error ? error.message : error);
    }

    if (quizzes.length === 0) quizzes = deterministicQuizzes(roadmap.id, input.packId, moduleSections, resources);

    return { roadmap, quizzes, degraded };
}

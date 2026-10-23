import type { PublicRoadmapCard, Roadmap } from "@/types";

function nowIso() {
    return new Date().toISOString();
}

function createSeedRoadmap(id: string, title: string, summary: string, mode: "general" | "intern", contentType: string): Roadmap {
    const timestamp = nowIso();

    return {
        id,
        title,
        summary,
        mode,
        contentType,
        rawContent: summary,
        createdAt: timestamp,
        updatedAt: timestamp,
        isPublic: true,
        forkCount: 0,
        sections: [
            {
                id: `${id}-module-1`,
                type: "module",
                title: "Foundation",
                order: 0,
                metadata: {
                    estimatedDuration: "1 week",
                    difficulty: "beginner",
                    taskCount: 2,
                    keyOutcome: "Understand the core structure before execution begins.",
                },
                data: {
                    description: summary,
                    estimatedTime: "1 week",
                    concepts: "Scope, sequencing, and execution rhythm",
                    objectives: ["Set up the workspace", "Start the first execution block"],
                    tasks: [
                        {
                            id: `${id}-task-1`,
                            title: "Review the roadmap structure",
                            completed: false,
                            notes: "",
                            subtasks: [],
                            attachments: [],
                            text: "Review the roadmap structure",
                            description: "Read through the sections and confirm the learning path.",
                            estimatedTime: "20 mins",
                            priority: "core",
                            done: false,
                        },
                        {
                            id: `${id}-task-2`,
                            title: "Begin the first module",
                            completed: false,
                            notes: "",
                            subtasks: [],
                            attachments: [],
                            text: "Begin the first module",
                            description: "Complete the first practical step in the workspace.",
                            estimatedTime: "45 mins",
                            priority: "core",
                            done: false,
                        },
                    ],
                    resources: [],
                    videos: [],
                    completed: false,
                },
            },
        ],
    };
}

export const SEEDED_GALLERY_ROADMAPS: Roadmap[] = [
    createSeedRoadmap(
        "seed:creator-launch-system",
        "Creator Launch System",
        "A polished launch playbook for creators building an editorial content engine and monetization loop.",
        "general",
        "playbook",
    ),
    createSeedRoadmap(
        "seed:intern-onboarding-lab",
        "Intern Onboarding Lab",
        "A structured intern roadmap for onboarding, weekly coaching, and review cycles.",
        "intern",
        "curriculum",
    ),
    createSeedRoadmap(
        "seed:course-outline-studio",
        "Course Outline Studio",
        "A fast-start curriculum template for building an AI-assisted professional course from raw notes.",
        "general",
        "curriculum",
    ),
];

export function toSeedCard(roadmap: Roadmap): PublicRoadmapCard {
    return {
        id: roadmap.id,
        title: roadmap.title,
        summary: roadmap.summary,
        mode: roadmap.mode,
        contentType: roadmap.contentType,
        difficulty: roadmap.difficulty,
        totalEstimatedDuration: roadmap.totalEstimatedDuration,
        moduleCount: roadmap.sections.filter((section) => section.type === "module").length,
        forkCount: roadmap.forkCount ?? 0,
        updatedAt: roadmap.updatedAt,
        isSeed: true,
    };
}

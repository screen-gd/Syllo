import { z } from "zod";
import { LEARNING_LEVELS, type Roadmap, type Section } from "@/types";

const resource = z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    type: z.enum([
        "video",
        "doc",
        "pdf",
        "link",
        "code",
        "tool",
        "course",
        "book",
    ]),
    description: z.string(),
    category: z.string().optional(),
});
const video = z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    videoId: z.string(),
    platform: z.enum(["youtube", "vimeo", "other"]),
    description: z.string(),
    duration: z.string().optional(),
    timestamps: z
        .array(z.object({ time: z.string(), label: z.string() }))
        .optional(),
});
const task = z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
    notes: z.string(),
    subtasks: z.array(
        z.object({ id: z.string(), title: z.string(), completed: z.boolean() }),
    ),
    attachments: z.array(resource),
    text: z.string().optional(),
    description: z.string().optional(),
    estimatedTime: z.string().optional(),
    priority: z.string().optional(),
    core: z.boolean().optional(),
    coreReason: z.string().optional(),
    done: z.boolean().optional(),
});
const baseSection = z.object({
    id: z.string(),
    title: z.string(),
    order: z.number(),
    metadata: z
        .object({
            estimatedDuration: z.string().optional(),
            difficulty: z.string().optional(),
            taskCount: z.number().optional(),
            keyOutcome: z.string().optional(),
        })
        .optional(),
});
const note = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export const sectionSchema: z.ZodType<Section> = z.discriminatedUnion("type", [
    baseSection.extend({
        type: z.literal("module"),
        level: z.enum(LEARNING_LEVELS).optional(),
        track: z.literal("reading").optional(),
        data: z.object({
            description: z.string(),
            estimatedTime: z.string().optional(),
            concepts: z.string().optional(),
            objectives: z.array(z.string()).optional(),
            notes: z.string().optional(),
            tasks: z.array(task),
            resources: z.array(resource),
            videos: z.array(video),
            completed: z.boolean(),
        }),
    }),
    baseSection.extend({
        type: z.literal("milestones"),
        data: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                description: z.string(),
                tasks: z.array(task),
                resources: z.array(resource),
                videos: z.array(video),
                completed: z.boolean(),
                order: z.number(),
            }),
        ),
    }),
    baseSection.extend({
        type: z.literal("tasks"),
        data: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                tasks: z.array(task),
            }),
        ),
    }),
    baseSection.extend({
        type: z.literal("resources"),
        data: z.array(resource),
    }),
    baseSection.extend({ type: z.literal("videos"), data: z.array(video) }),
    baseSection.extend({ type: z.literal("notes"), data: z.array(note) }),
    baseSection.extend({
        type: z.literal("progress"),
        data: z.record(z.string(), z.never()),
    }),
    baseSection.extend({
        type: z.literal("calendar"),
        data: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                date: z.string(),
                description: z.string(),
                completed: z.boolean(),
            }),
        ),
    }),
    baseSection.extend({
        type: z.literal("glossary"),
        data: z.array(
            z.object({
                id: z.string(),
                term: z.string(),
                definition: z.string(),
                relatedSections: z.array(z.string()).optional(),
            }),
        ),
    }),
    baseSection.extend({
        type: z.literal("submissions"),
        data: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                description: z.string(),
                attachment: z.string().optional(),
                attachmentType: z.enum(["link", "file"]).optional(),
                status: z.enum([
                    "pending",
                    "submitted",
                    "approved",
                    "revision",
                ]),
                feedback: z.string().optional(),
                createdAt: z.string(),
                reviewedAt: z.string().optional(),
                submittedBy: z.string().optional(),
            }),
        ),
    }),
    baseSection.extend({
        type: z.literal("custom"),
        data: z.object({
            description: z.string(),
            layout: z.enum(["checklist", "cards", "table", "list"]),
            items: z.array(
                z.object({
                    id: z.string(),
                    title: z.string(),
                    description: z.string().optional(),
                    completed: z.boolean().optional(),
                    metadata: z.record(z.string(), z.string()).optional(),
                }),
            ),
        }),
    }),
]);

export const roadmapSchema: z.ZodType<Roadmap> = z.object({
    id: z.string(),
    title: z.string(),
    mode: z.enum(["general", "intern"]),
    sections: z.array(sectionSchema),
    rawContent: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    summary: z.string().optional(),
    objectives: z.array(z.string()).optional(),
    branding: z
        .object({
            customTitle: z.string().optional(),
            hideWatermark: z.boolean().optional(),
            accentColor: z.string().optional(),
            logoUrl: z.string().optional(),
        })
        .optional(),
    contentType: z.string().optional(),
    detectedContext: z.string().optional(),
    totalEstimatedDuration: z.string().optional(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    goal: z.string().optional(),
    isPublic: z.boolean().optional(),
    forkCount: z.number().optional(),
    forkedFrom: z.string().nullable().optional(),
    ownerId: z.string().optional(),
    packVersion: z.string().optional(),
});

export const fsrsCardSchema = z.object({
    due: z.string(),
    stability: z.number(),
    difficulty: z.number(),
    elapsed_days: z.number(),
    scheduled_days: z.number(),
    reps: z.number(),
    lapses: z.number(),
    learning_steps: z.number(),
    state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    last_review: z.string().optional(),
});
export const reviewSchema = z.object({
    id: z.string(),
    roadmapId: z.string(),
    sectionId: z.string().optional(),
    prompt: z.string(),
    answer: z.string(),
    easeFactor: z.number(),
    intervalDays: z.number(),
    repetitions: z.number(),
    dueAt: z.string(),
    lastReviewedAt: z.string().nullable().optional(),
    status: z.enum(["suggested", "kept", "skipped"]).optional(),
    fsrs: fsrsCardSchema.optional(),
    source: z
        .object({
            url: z.string().optional(),
            bookId: z.string().optional(),
            cfi: z.string().optional(),
            seconds: z.number().optional(),
            quote: z.string().optional(),
            taskId: z.string().optional(),
        })
        .optional(),
});

export const bookSchema = z.object({
    id: z.string(),
    title: z.string(),
    author: z.string(),
    category: z.string(),
    status: z.enum(["to-read", "reading", "finished"]),
    fileName: z.string(),
    fileSize: z.number(),
    fingerprint: z.string(),
    coverKey: z.string().nullable(),
    fileKey: z.string(),
    cloudFileId: z.string().nullable(),
    cloudCoverId: z.string().nullable(),
    position: z.string().nullable(),
    chapter: z.string(),
    percent: z.number().min(0).max(100),
    locations: z.string().nullable(),
    addedAt: z.string(),
    lastReadAt: z.string().nullable(),
    color: z.string(),
});
export type LibraryBook = z.infer<typeof bookSchema>;

export const studySchema = z.object({
    roadmapId: z.string(),
    taskId: z.string(),
    resourceUrl: z.string(),
    seconds: z.number().nonnegative(),
    lastOpenedAt: z.string(),
});
export type StudyPosition = z.infer<typeof studySchema>;
export const annotationSchema = z.object({
    text: z.string(),
    quote: z.string(),
    color: z.string(),
    anchor: z.discriminatedUnion("kind", [
        z.object({
            kind: z.literal("book"),
            bookId: z.string(),
            cfi: z.string(),
        }),
        z.object({
            kind: z.literal("lesson"),
            roadmapId: z.string(),
            taskId: z.string(),
            url: z.string(),
            seconds: z.number().nonnegative(),
        }),
    ]),
    createdAt: z.string(),
});
export const timerSettingsSchema = z.object({
    focus: z.number().min(1).max(120),
    rest: z.number().min(1).max(60),
});
const entry = z.object({
    id: z.string(),
    updatedAt: z.number(),
    deleted: z.boolean().default(false),
});
export const personalEntrySchema = z.discriminatedUnion("kind", [
    entry.extend({ kind: z.literal("book"), data: bookSchema }),
    entry.extend({ kind: z.literal("study"), data: studySchema }),
    entry.extend({ kind: z.literal("annotation"), data: annotationSchema }),
    entry.extend({ kind: z.literal("timer"), data: timerSettingsSchema }),
    entry.extend({ kind: z.literal("review"), data: reviewSchema }),
    entry.extend({ kind: z.literal("roadmap"), data: roadmapSchema }),
]);
export type PersonalEntry = z.infer<typeof personalEntrySchema>;
export const personalSnapshotSchema = z.record(z.string(), personalEntrySchema);
export type PersonalSnapshot = z.infer<typeof personalSnapshotSchema>;

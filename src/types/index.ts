/* ZNS RoadMap Studio type definitions */

/* Section types */
export type SectionType =
    | "module"
    | "milestones"
    | "tasks"
    | "progress"
    | "resources"
    | "videos"
    | "calendar"
    | "notes"
    | "glossary"
    | "submissions"
    | "custom";

/* Core roadmap model */
export interface Roadmap {
    id: string;
    title: string;
    mode: "general" | "intern";
    summary?: string;
    objectives?: string[];
    sections: Section[];
    rawContent: string;
    createdAt: string;
    updatedAt: string;
    branding?: {
        customTitle?: string;
        hideWatermark?: boolean;
        accentColor?: string;
        logoUrl?: string;
    };
    contentType?: "roadmap" | "playbook" | "curriculum" | "strategy" | "tutorial" | "reference" | "plan" | "other" | string;
    detectedContext?: string;
    totalEstimatedDuration?: string;
    difficulty?: "beginner" | "intermediate" | "advanced";
    goal?: string;
    isPublic?: boolean;
    forkCount?: number;
    forkedFrom?: string | null;
    ownerId?: string;
}

/* Section discriminated union */
export interface SectionBase {
    id: string;
    title: string;
    order: number;
    metadata?: {
        estimatedDuration?: string;
        difficulty?: "beginner" | "intermediate" | "advanced" | string;
        taskCount?: number;
        keyOutcome?: string;
    };
}

export type Section =
    | ModuleSection
    | MilestoneSection
    | TaskSection
    | ProgressSection
    | ResourceSection
    | VideoSection
    | CalendarSection
    | NoteSection
    | GlossarySection
    | SubmissionSection
    | CustomSection;

export interface ModuleSection extends SectionBase {
    type: "module";
    data: {
        description: string;
        estimatedTime?: string;
        concepts?: string;
        objectives?: string[];
        notes?: string;
        tasks: Task[];
        resources: Resource[];
        videos: Video[];
        completed: boolean;
    };
}

export interface MilestoneSection extends SectionBase {
    type: "milestones";
    data: Milestone[];
}

export interface TaskSection extends SectionBase {
    type: "tasks";
    data: TaskGroup[];
}

export interface ProgressSection extends SectionBase {
    type: "progress";
    data: Record<string, never>;
}

export interface ResourceSection extends SectionBase {
    type: "resources";
    data: Resource[];
}

export interface VideoSection extends SectionBase {
    type: "videos";
    data: Video[];
}

export interface CalendarSection extends SectionBase {
    type: "calendar";
    data: CalendarEvent[];
}

export interface NoteSection extends SectionBase {
    type: "notes";
    data: Note[];
}

export interface GlossarySection extends SectionBase {
    type: "glossary";
    data: GlossaryTerm[];
}

export interface SubmissionSection extends SectionBase {
    type: "submissions";
    data: Submission[];
}

export interface CustomSection extends SectionBase {
    type: "custom";
    data: CustomSectionData;
}

/* Data models */
export interface Milestone {
    id: string;
    title: string;
    description: string;
    tasks: Task[];
    resources: Resource[];
    videos: Video[];
    completed: boolean;
    order: number;
}

export interface TaskGroup {
    id: string;
    title: string;
    tasks: Task[];
}

export interface Task {
    id: string;
    title: string;
    completed: boolean;
    notes: string;
    subtasks: SubTask[];
    attachments: Resource[];
    text?: string;
    description?: string;
    estimatedTime?: string;
    priority?: "core" | "optional" | "advanced" | string;
    done?: boolean;
}

export interface SubTask {
    id: string;
    title: string;
    completed: boolean;
}

export interface Resource {
    id: string;
    title: string;
    url: string;
    type: "video" | "doc" | "pdf" | "link" | "code" | "tool" | "course" | "book";
    description: string;
    category?: string;
}

export interface Video {
    id: string;
    title: string;
    url: string;
    videoId: string;
    platform: "youtube" | "vimeo" | "other";
    description: string;
    duration?: string;
    timestamps?: VideoTimestamp[];
}

export interface VideoTimestamp {
    time: string;
    label: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    description: string;
    completed: boolean;
}

export interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export interface GlossaryTerm {
    id: string;
    term: string;
    definition: string;
    relatedSections?: string[];
}

export interface Submission {
    id: string;
    title: string;
    description: string;
    attachment?: string;
    attachmentType?: "link" | "file";
    status: "pending" | "submitted" | "approved" | "revision";
    feedback?: string;
    createdAt: string;
    reviewedAt?: string;
    submittedBy?: string;
}

export interface CustomSectionData {
    description: string;
    layout: "checklist" | "cards" | "table" | "list";
    items: CustomItem[];
}

export interface CustomItem {
    id: string;
    title: string;
    description?: string;
    completed?: boolean;
    metadata?: Record<string, string>;
}

export type StorageMode = "local-only";

export interface StorageStatus {
    mode: StorageMode;
    email?: string | null;
    cloudAvailable: boolean;
}

export interface SrsItem {
    id: string;
    roadmapId: string;
    sectionId?: string;
    prompt: string;
    answer: string;
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
    dueAt: string;
    lastReviewedAt?: string | null;
}

export interface CreditStatus {
    planId: string;
    allowance: number;
    used: number;
    remaining: number;
    resetDate: string;
}

export interface CreditTransaction {
    id: string;
    kind: "workspace_generation" | "module_regeneration" | "quiz" | "export_pdf" | "review" | "adjustment";
    amount: number;
    createdAt: string;
    metadata?: Record<string, string>;
}

export interface PrivacySettings {
    anonymousAnalytics: boolean;
    allowPublicGallery: boolean;
}

export interface ProgressSnapshot {
    id: string;
    roadmapId: string;
    sectionId: string;
    completionRate: number;
    completedTasks: number;
    totalTasks: number;
    createdAt: string;
}

export interface CoachingSession {
    id: string;
    roadmapId: string;
    date: string;
    durationMinutes: number;
    topics: string[];
    nextSteps: string;
}

export interface PublicRoadmapCard {
    id: string;
    title: string;
    summary?: string;
    mode: "general" | "intern";
    contentType?: string;
    difficulty?: "beginner" | "intermediate" | "advanced";
    totalEstimatedDuration?: string;
    moduleCount?: number;
    forkCount: number;
    updatedAt: string;
    isSeed?: boolean;
}

/* API types */
export interface ParseRoadmapRequest {
    content: string;
    mode: "general" | "intern";
    title?: string;
}

export interface ParseRoadmapResponse {
    success: boolean;
    roadmap?: Omit<Roadmap, "id" | "createdAt" | "updatedAt" | "rawContent">;
    error?: string;
}

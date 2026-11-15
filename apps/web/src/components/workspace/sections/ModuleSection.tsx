"use client";
import { fetchPrivateApi } from "@/lib/private-api-fetch";


import { useState, useEffect, useMemo } from "react";
import type { ModuleSection as ModuleSectionType, Section, Task, Roadmap, Resource } from "@/types";
import SmartEmbed from "@/components/shared/SmartEmbed";
import { getAiProviderInvalidKeyMessage } from "@/lib/ai-config";
import { getActiveApiKey, getActiveModel, getUserConfig } from "@/lib/userConfig";
import {
    Attachment,
    BookOpen,
    Check,
    ChevronLeft,
    ChevronRight,
    Close,
    Code,
    Document,
    External,
    FileVideo,
    Icon,
    Link as LinkIcon,
    Pending,
    Retry,
    Time,
    Tool,
    Trophy,
    Undo,
    type GlazeIcon,
} from "@/components/glaze/icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/glaze/ui/alert";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import { Checkbox } from "@/components/glaze/ui/checkbox";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/glaze/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/glaze/ui/empty-state";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemLink,
    ItemMedia,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { Progress, ProgressLabel, ProgressValue } from "@/components/glaze/ui/progress";
import { RadioGroup, RadioGroupOption } from "@/components/glaze/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/glaze/ui/tabs";
import { Textarea } from "@/components/glaze/ui/textarea";
import { cn } from "@/lib/glaze/utils";

/** The glyph shown beside a resource, by its type. */
const RESOURCE_ICONS: Record<string, GlazeIcon> = {
    video: FileVideo,
    doc: Document,
    pdf: BookOpen,
    link: LinkIcon,
    code: Code,
    tool: Tool,
    course: Trophy,
    book: BookOpen,
};

interface Props {
    section: ModuleSectionType;
    roadmap?: Roadmap;
    onUpdate: (updater: (s: Section) => Section) => void;
    onNavigate?: (id: string) => void;
    onApiError?: (error: { message: string }) => void;
}

type TabType = 'overview' | 'tasks' | 'resources' | 'videos' | 'quiz' | 'notes';

interface QuizQuestion {
    id: string;
    prompt: string;
    choices: string[];
    answerIndex: number;
    explanation: string;
}

interface QuizPayload {
    sectionId: string;
    title: string;
    questions: QuizQuestion[];
}

export default function ModuleSection({ section, roadmap, onUpdate, onNavigate, onApiError }: Props) {
    const data = section.data;
    const tasks = data.tasks || [];
    const resources = data.resources || [];
    const videos = data.videos || [];
    const objectives = data.objectives || [];
    const glossaryHasContent = Boolean(
        roadmap?.sections.some((candidate) => candidate.type === "glossary" && candidate.data.length > 0),
    );
    const hasTaskQuizSource = tasks.some((task) => Boolean(task.title || task.description || task.text || task.notes));
    const canGenerateQuiz = Boolean(
        roadmap && (data.description?.trim() || data.notes?.trim() || glossaryHasContent || hasTaskQuizSource),
    );
    const quizCacheKey = roadmap ? `zns:v1:quiz:${roadmap.id}:${section.id}` : null;
    const quizScoreKey = roadmap ? `zns:v1:quiz-score:${roadmap.id}:${section.id}:${new Date().toISOString().slice(0, 10)}` : null;

    // Calculate tabs to show
    const hasOverview = !!(data.description || data.concepts || objectives.length > 0);
    const availableTabs: { id: TabType; label: string }[] = useMemo(() => {
        const tabs: { id: TabType; label: string }[] = [];
        if (hasOverview) tabs.push({ id: 'overview', label: 'Overview' });
        if (tasks.length > 0) tabs.push({ id: 'tasks', label: 'Tasks' });
        if (resources.length > 0) tabs.push({ id: 'resources', label: 'Resources' });
        if (videos.length > 0) tabs.push({ id: 'videos', label: 'Videos' });
        if (canGenerateQuiz) tabs.push({ id: 'quiz', label: 'Quiz' });
        tabs.push({ id: 'notes', label: 'Notes' });
        return tabs;
    }, [canGenerateQuiz, hasOverview, resources.length, tasks.length, videos.length]);

    const [activeTab, setActiveTab] = useState<TabType>(availableTabs[0].id);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(videos.length > 0 ? videos[0].id : null);
    const [sidePanelResource, setSidePanelResource] = useState<Resource | null>(null);

    const [showRegenConfirm, setShowRegenConfirm] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenError, setRegenError] = useState("");

    const [notesText, setNotesText] = useState(data.notes || "");
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving..." | "">("");
    const [quizData, setQuizData] = useState<QuizPayload | null>(null);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
    const [quizScore, setQuizScore] = useState<number | null>(null);
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [quizError, setQuizError] = useState("");
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

    const handleRegenerate = async () => {
        setShowRegenConfirm(false);
        setIsRegenerating(true);
        setRegenError("");
        try {
            const userConfig = getUserConfig();
            const activeApiKey = getActiveApiKey(userConfig);

            const payload: any = {
                content: "Regenerate only this section data: " + JSON.stringify(section.data),
                mode: roadmap?.mode || "general",
                title: section.title + " (REGENERATE SECTION ONLY)",
            };

            if (userConfig?.useCustomKey && activeApiKey) {
                payload.userApiKey = activeApiKey;
                payload.userModel = getActiveModel(userConfig);
                payload.userProvider = userConfig.provider;
            }

            const res = await fetchPrivateApi("/api/parse-roadmap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.error === "invalid_key") {
                const invalidKeyMessage = json.message ?? getAiProviderInvalidKeyMessage(userConfig.provider);
                setRegenError(invalidKeyMessage);
                onApiError?.({ message: invalidKeyMessage });
                setIsRegenerating(false);
                return;
            }
            if (json.success && json.roadmap?.sections?.length > 0) {
                const newSectionData = json.roadmap.sections[0].data;
                onUpdate((s) => {
                    const ms = s as ModuleSectionType;
                    return {
                        ...s,
                        data: {
                            ...s.data,
                            ...newSectionData,
                            completed: ms.data.completed // preserve completion
                        }
                    };
                });
            } else {
                setRegenError("Failed to regenerate module.");
            }
        } catch {
            setRegenError("An error occurred during regeneration.");
        } finally {
            setIsRegenerating(false);
        }
    };

    useEffect(() => {
        setNotesText(section.data.notes || "");
    }, [section.id, section.data.notes]);

    useEffect(() => {
        if (!availableTabs.some((tab) => tab.id === activeTab)) {
            setActiveTab(availableTabs[0].id);
        }
    }, [activeTab, availableTabs]);

    useEffect(() => {
        if (!quizCacheKey || typeof window === "undefined") {
            setQuizData(null);
            setSelectedAnswers({});
            setQuizScore(null);
            setQuizSubmitted(false);
            return;
        }

        try {
            const storedQuiz = localStorage.getItem(quizCacheKey);
            setQuizData(storedQuiz ? JSON.parse(storedQuiz) as QuizPayload : null);
        } catch {
            setQuizData(null);
        }

        try {
            const storedScore = quizScoreKey ? localStorage.getItem(quizScoreKey) : null;
            if (!storedScore) {
                setSelectedAnswers({});
                setQuizScore(null);
                setQuizSubmitted(false);
                return;
            }

            const parsed = JSON.parse(storedScore) as { selectedAnswers?: Record<string, number>; score?: number };
            setSelectedAnswers(parsed.selectedAnswers ?? {});
            setQuizScore(typeof parsed.score === "number" ? parsed.score : null);
            setQuizSubmitted(typeof parsed.score === "number");
        } catch {
            setSelectedAnswers({});
            setQuizScore(null);
            setQuizSubmitted(false);
        }
    }, [quizCacheKey, quizScoreKey]);

    useEffect(() => {
        if (notesText === (section.data.notes || "")) {
            setSaveStatus("");
            return;
        }

        setSaveStatus("saving...");
        const timeoutId = window.setTimeout(() => {
            onUpdate((candidate) => {
                const moduleSection = candidate as ModuleSectionType;
                return {
                    ...moduleSection,
                    data: {
                        ...moduleSection.data,
                        notes: notesText,
                    },
                };
            });
            setSaveStatus("saved");
        }, 400);

        const clearStatusId = window.setTimeout(() => {
            setSaveStatus("");
        }, 1600);

        return () => {
            window.clearTimeout(timeoutId);
            window.clearTimeout(clearStatusId);
        };
    }, [notesText, onUpdate, section.data.notes]);

    let completedCount = 0;
    let totalCount = 0;
    tasks.forEach(t => {
        totalCount++;
        if (t.completed) completedCount++;
        (t.subtasks || []).forEach(st => {
            totalCount++;
            if (st.completed) completedCount++;
        });
    });
    const taskPercent = data.completed ? 100 : (totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);

    const toggleModuleComplete = () => {
        onUpdate((s) => {
            const ms = s as ModuleSectionType;
            const isNowCompleted = !ms.data.completed;
            return {
                ...ms,
                data: {
                    ...ms.data,
                    completed: isNowCompleted,
                    tasks: isNowCompleted ? (ms.data.tasks || []).map(t => ({
                        ...t,
                        completed: true,
                        subtasks: (t.subtasks || []).map(st => ({ ...st, completed: true }))
                    })) : ms.data.tasks
                },
            };
        });
    };

    const toggleTask = (taskId: string) => {
        onUpdate((s) => {
            const ms = s as ModuleSectionType;
            return {
                ...ms,
                data: {
                    ...ms.data,
                    tasks: (ms.data.tasks || []).map((t) =>
                        t.id === taskId ? { ...t, completed: !t.completed } : t
                    ),
                },
            };
        });
    };

    const toggleSubtask = (taskId: string, subId: string) => {
        onUpdate((s) => {
            const ms = s as ModuleSectionType;
            return {
                ...ms,
                data: {
                    ...ms.data,
                    tasks: (ms.data.tasks || []).map((t) =>
                        t.id === taskId
                            ? {
                                ...t,
                                subtasks: (t.subtasks || []).map((st) =>
                                    st.id === subId ? { ...st, completed: !st.completed } : st
                                ),
                            }
                            : t
                    ),
                },
            };
        });
    };

    const handleGenerateQuiz = async () => {
        if (!roadmap) return;

        setQuizError("");
        setIsGeneratingQuiz(true);

        try {
            const userConfig = getUserConfig();
            const activeApiKey = getActiveApiKey(userConfig);
            const response = await fetchPrivateApi("/api/quiz/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roadmap,
                    sectionId: section.id,
                    userApiKey: userConfig.useCustomKey ? activeApiKey : undefined,
                    userModel: userConfig.useCustomKey ? getActiveModel(userConfig) : undefined,
                    userProvider: userConfig.useCustomKey ? userConfig.provider : undefined,
                }),
            });

            const payload = await response.json();
            if (!payload.success || !payload.quiz) {
                const message = "Failed to generate a quiz for this module.";

                setQuizError(message);
                onApiError?.({ message });
                return;
            }

            const nextQuiz = payload.quiz as QuizPayload;
            setQuizData(nextQuiz);
            setSelectedAnswers({});
            setQuizScore(null);
            setQuizSubmitted(false);

            if (quizCacheKey) {
                localStorage.setItem(quizCacheKey, JSON.stringify(nextQuiz));
            }
            if (quizScoreKey) {
                localStorage.removeItem(quizScoreKey);
            }
        } catch {
            const message = "An error occurred while generating the quiz.";
            setQuizError(message);
            onApiError?.({ message });
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const handleQuizChoice = (questionId: string, answerIndex: number) => {
        if (quizSubmitted) return;
        setSelectedAnswers((current) => ({ ...current, [questionId]: answerIndex }));
    };

    const handleQuizSubmit = () => {
        if (!quizData) return;

        const score = quizData.questions.reduce((total, question) => {
            return total + (selectedAnswers[question.id] === question.answerIndex ? 1 : 0);
        }, 0);

        setQuizScore(score);
        setQuizSubmitted(true);

        if (quizScoreKey) {
            localStorage.setItem(quizScoreKey, JSON.stringify({ score, selectedAnswers }));
        }
    };

    // Navigation logic
    const moduleSections = roadmap?.sections.filter(s => s.type === "module" || s.type === "milestones") || [];
    const currentIndex = moduleSections.findIndex(s => s.id === section.id);
    const prevModule = currentIndex > 0 ? moduleSections[currentIndex - 1] : null;
    const nextModule = currentIndex >= 0 && currentIndex < moduleSections.length - 1 ? moduleSections[currentIndex + 1] : null;
    const activeVideo = videos.find(v => v.id === activeVideoId);

    const resourceTypeIcon = (type: string) => RESOURCE_ICONS[type] ?? Attachment;

    return (
        <div className="shell relative flex h-full flex-col">
            <div className="panel flex min-h-0 flex-1 flex-col">
                {/* Module Top Header */}
                <div className="flex flex-col gap-4 border-b border-line-faint p-4 sm:p-6">
                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                        <div className="min-w-0">
                            <h2 className="type-title">{section.title}</h2>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 type-caption text-text-2">
                                {currentIndex >= 0 && (
                                    <span>Module {currentIndex + 1} of {moduleSections.length}</span>
                                )}
                                <span>{taskPercent}% complete</span>
                                {data.estimatedTime && (
                                    <span className="inline-flex items-center gap-1">
                                        <Icon icon={Time} className="text-text-3" />
                                        {data.estimatedTime}
                                    </span>
                                )}
                                {section.metadata?.estimatedDuration && (
                                    <span className="inline-flex items-center gap-1">
                                        <Icon icon={Time} className="text-text-3" />
                                        {section.metadata.estimatedDuration}
                                    </span>
                                )}
                                {section.metadata?.difficulty && (
                                    <Badge>
                                        {section.metadata.difficulty.charAt(0).toUpperCase() + section.metadata.difficulty.slice(1)}
                                    </Badge>
                                )}
                                {section.metadata?.keyOutcome && (
                                    <span>{section.metadata.keyOutcome}</span>
                                )}
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            <Button
                                variant="secondary"
                                size="icon"
                                aria-label="Regenerate module"
                                onClick={() => setShowRegenConfirm(true)}
                                disabled={isRegenerating}
                            >
                                <Icon icon={isRegenerating ? Pending : Retry} className={isRegenerating ? "animate-spin" : undefined} />
                            </Button>
                            <Button
                                variant={data.completed ? "secondary" : "primary"}
                                onClick={toggleModuleComplete}
                            >
                                <Icon icon={data.completed ? Undo : Check} />
                                {data.completed ? "Mark incomplete" : "Mark complete"}
                            </Button>
                        </div>
                    </div>

                    {regenError && (
                        <Alert status="fail">
                            <AlertDescription>{regenError}</AlertDescription>
                        </Alert>
                    )}
                    {isRegenerating && (
                        <p role="status" className="inline-flex items-center gap-2 type-body-sm text-text-2">
                            <Icon icon={Pending} className="animate-spin" />
                            Regenerating module...
                        </p>
                    )}
                </div>

                <Tabs
                    value={activeTab}
                    onValueChange={(value) => {
                        setActiveTab(value as TabType);
                        setSidePanelResource(null);
                    }}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="border-b border-line-faint px-4 py-2 sm:px-6">
                        <TabsList aria-label="Module">
                            {availableTabs.map((tab) => (
                                <TabsTrigger key={tab.id} value={tab.id}>
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="relative min-h-0 w-full flex-1 overflow-y-auto">
                        {/* 1. Overview Tab */}
                        <TabsContent value="overview" className="flex flex-col gap-8 p-4 sm:p-6">
                            {data.description && (
                                <section>
                                    <h3 className="type-heading-sm">Description</h3>
                                    <p className="mt-2 max-w-measure type-body text-text-2">
                                        {data.description}
                                    </p>
                                </section>
                            )}

                            {objectives.length > 0 && (
                                <section>
                                    <h3 className="type-heading-sm">Learning objectives</h3>
                                    <ul className="mt-2 flex flex-col gap-2">
                                        {objectives.map((obj, i) => (
                                            <li key={i} className="flex items-start gap-3 type-body text-text-1">
                                                <Icon icon={Check} className="mt-1 text-text-3" />
                                                {obj}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {data.concepts && (
                                <section>
                                    <h3 className="type-heading-sm">Key concepts</h3>
                                    <p className="mt-2 max-w-measure whitespace-pre-wrap type-body text-text-2">
                                        {data.concepts}
                                    </p>
                                </section>
                            )}
                        </TabsContent>

                        {/* 2. Tasks Tab */}
                        <TabsContent value="tasks" className="flex flex-col gap-4 p-4 sm:p-6">
                            <Progress value={taskPercent}>
                                <ProgressLabel>Action items</ProgressLabel>
                                <ProgressValue>{() => `${completedCount} / ${totalCount} completed`}</ProgressValue>
                            </Progress>

                            <ul className="flex flex-col gap-2">
                                {tasks.map((task: Task) => (
                                    <li key={task.id} className="rounded-panel border border-line-faint p-3">
                                        <label className="flex cursor-pointer items-start gap-3">
                                            <Checkbox
                                                className="mt-0.5"
                                                checked={!!task.completed}
                                                onCheckedChange={() => toggleTask(task.id)}
                                            />
                                            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                                <span className={cn("type-body", task.completed ? "text-text-2 line-through" : "text-text-1")}>
                                                    {task.title}
                                                </span>
                                                {task.priority && (
                                                    <Badge>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</Badge>
                                                )}
                                                {task.estimatedTime && (
                                                    <span className="inline-flex items-center gap-1 type-caption text-text-2">
                                                        <Icon icon={Time} className="text-text-3" />
                                                        {task.estimatedTime}
                                                    </span>
                                                )}
                                            </span>
                                        </label>

                                        {/* Subtasks */}
                                        {(task.subtasks || []).length > 0 && (
                                            <ul className="mt-2 ms-7 flex flex-col gap-1">
                                                {(task.subtasks || []).map((sub) => (
                                                    <li key={sub.id}>
                                                        <label className="flex cursor-pointer items-start gap-2 py-1">
                                                            <Checkbox
                                                                className="mt-0.5"
                                                                checked={!!sub.completed}
                                                                onCheckedChange={() => toggleSubtask(task.id, sub.id)}
                                                            />
                                                            <span className={cn("type-body-sm", sub.completed ? "text-text-2 line-through" : "text-text-1")}>
                                                                {sub.title}
                                                            </span>
                                                        </label>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </TabsContent>

                        {/* 3. Resources Tab */}
                        <TabsContent value="resources" className="p-4 sm:p-6">
                            <div className={cn("grid gap-4", sidePanelResource && "lg:grid-cols-2")}>
                                <ItemGroup aria-label="Course materials">
                                    {resources.map((res) => (
                                        <Item key={res.id} selected={sidePanelResource?.id === res.id}>
                                            <ItemMedia variant="icon">
                                                <Icon icon={resourceTypeIcon(res.type)} />
                                            </ItemMedia>
                                            <ItemContent>
                                                <ItemTitle>
                                                    <ItemLink
                                                        href={res.url}
                                                        aria-current={sidePanelResource?.id === res.id ? "true" : undefined}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setSidePanelResource(res);
                                                        }}
                                                    >
                                                        {res.title}
                                                    </ItemLink>
                                                </ItemTitle>
                                                {res.description && <ItemDescription>{res.description}</ItemDescription>}
                                            </ItemContent>
                                        </Item>
                                    ))}
                                </ItemGroup>

                                {/* Resource Side Panel */}
                                {sidePanelResource && (
                                    <div className="panel flex min-h-0 flex-col">
                                        <div className="flex items-center justify-between gap-3 border-b border-line-faint p-3">
                                            <h4 className="min-w-0 truncate type-heading-sm">{sidePanelResource.title}</h4>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Close resource"
                                                onClick={() => setSidePanelResource(null)}
                                            >
                                                <Icon icon={Close} />
                                            </Button>
                                        </div>
                                        <div className="flex flex-1 flex-col gap-3 p-3">
                                            {sidePanelResource.description && (
                                                <p className="type-body-sm text-text-2">{sidePanelResource.description}</p>
                                            )}
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="self-start"
                                                nativeButton={false}
                                                render={<a href={sidePanelResource.url} target="_blank" rel="noopener noreferrer" />}
                                            >
                                                Open in new tab
                                                <Icon icon={External} />
                                            </Button>
                                            <div className="min-h-75 flex-1 overflow-hidden rounded-panel border border-line-faint">
                                                <SmartEmbed url={sidePanelResource.url} title={sidePanelResource.title} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="quiz" className="flex flex-col gap-4 p-4 sm:p-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h3 className="type-heading-sm">Knowledge check</h3>
                                    <p className="mt-1 max-w-measure type-body-sm text-text-2">
                                        Turn this module into a short multiple-choice quiz based on its tasks, notes, glossary terms, and description.
                                    </p>
                                </div>
                                <Button
                                    variant={quizData ? "secondary" : "primary"}
                                    onClick={() => void handleGenerateQuiz()}
                                    pending={isGeneratingQuiz}
                                    pendingLabel="Generating quiz"
                                >
                                    {quizData ? "Generate fresh quiz" : "Generate quiz"}
                                </Button>
                            </div>

                            {quizError && (
                                <Alert status="fail">
                                    <AlertDescription>{quizError}</AlertDescription>
                                </Alert>
                            )}

                            {!quizData ? (
                                <Empty reason="empty">
                                    <EmptyHeader>
                                        <EmptyTitle>No quiz generated yet</EmptyTitle>
                                        <EmptyDescription>
                                            Generate a five-question review for this module when you want a fast checkpoint before moving on.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {quizSubmitted && quizScore !== null && (
                                        <Alert status={quizScore === quizData.questions.length ? "ok" : "neutral"}>
                                            <AlertTitle>
                                                Score: {quizScore} / {quizData.questions.length}
                                            </AlertTitle>
                                            <AlertDescription>
                                                Your score is saved for today in this browser so you can review explanations without losing your answers.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {quizData.questions.map((question, index) => {
                                        const selectedAnswer = selectedAnswers[question.id];
                                        const isCorrect = selectedAnswer === question.answerIndex;

                                        return (
                                            <fieldset key={question.id} className="rounded-panel border border-line-faint p-4">
                                                <div className="mb-3 flex items-start justify-between gap-4">
                                                    <legend className="type-heading-sm">
                                                        <span className="sr-only">Question {index + 1}: </span>
                                                        {question.prompt}
                                                    </legend>
                                                    {quizSubmitted && (
                                                        <Badge variant={isCorrect ? "ok" : "fail"}>
                                                            {isCorrect ? "Correct" : "Review"}
                                                        </Badge>
                                                    )}
                                                </div>

                                                <RadioGroup
                                                    aria-label={`Question ${index + 1}`}
                                                    value={selectedAnswer === undefined ? null : String(selectedAnswer)}
                                                    onValueChange={(value) => handleQuizChoice(question.id, Number(value))}
                                                    disabled={quizSubmitted}
                                                >
                                                    {question.choices.map((choice, choiceIndex) => (
                                                        <RadioGroupOption
                                                            key={`${question.id}-${choiceIndex}`}
                                                            value={String(choiceIndex)}
                                                            label={choice}
                                                            description={
                                                                quizSubmitted && question.answerIndex === choiceIndex
                                                                    ? "Correct answer"
                                                                    : undefined
                                                            }
                                                        />
                                                    ))}
                                                </RadioGroup>

                                                {quizSubmitted && (
                                                    <p className="mt-3 rounded-panel bg-field p-3 type-body-sm text-text-2">
                                                        <span className="font-medium text-text-1">Explanation:</span> {question.explanation}
                                                    </p>
                                                )}
                                            </fieldset>
                                        );
                                    })}

                                    {!quizSubmitted && (
                                        <Button
                                            className="self-start"
                                            onClick={handleQuizSubmit}
                                            disabled={quizData.questions.some((question) => selectedAnswers[question.id] === undefined)}
                                        >
                                            Submit answers
                                        </Button>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        {/* 4. Videos Tab */}
                        <TabsContent value="videos" className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
                            <div className="min-w-0 flex-1">
                                {activeVideo && (
                                    <div className="flex flex-col gap-3">
                                        <div className="aspect-16/9 w-full overflow-hidden rounded-panel border border-line-faint">
                                            <SmartEmbed url={activeVideo.url || ""} title={activeVideo.title || "Video"} />
                                        </div>
                                        <h3 className="type-heading">{activeVideo.title}</h3>
                                        {activeVideo.description && (
                                            <p className="max-w-measure type-body text-text-2">{activeVideo.description}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Playlist Sidebar */}
                            <div className="w-full shrink-0 lg:w-80">
                                <h3 className="mb-2 type-heading-sm">Playlist</h3>
                                <ItemGroup aria-label="Playlist">
                                    {videos.map(v => (
                                        <Item key={v.id} selected={activeVideoId === v.id}>
                                            <ItemContent>
                                                <ItemTitle>
                                                    <ItemLink
                                                        href={v.url}
                                                        aria-current={activeVideoId === v.id ? "true" : undefined}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setActiveVideoId(v.id);
                                                        }}
                                                    >
                                                        {v.title}
                                                    </ItemLink>
                                                </ItemTitle>
                                                {v.duration && <ItemDescription>{v.duration}</ItemDescription>}
                                            </ItemContent>
                                        </Item>
                                    ))}
                                </ItemGroup>
                            </div>
                        </TabsContent>

                        {/* 5. Notes Tab */}
                        <TabsContent value="notes" keepMounted className="flex flex-col gap-2 p-4 sm:p-6">
                            <Field>
                                <div className="flex items-center justify-between gap-3">
                                    <FieldLabel>Module notes</FieldLabel>
                                    <span role="status" className="type-caption text-text-2">
                                        {saveStatus === "saving..." ? "Saving..." : saveStatus === "saved" ? "Saved" : ""}
                                    </span>
                                </div>
                                <Textarea
                                    autoGrow
                                    minRows={10}
                                    maxRows={30}
                                    value={notesText}
                                    onValueChange={setNotesText}
                                    placeholder="Type your notes for this module here. Autosaves as you type."
                                />
                            </Field>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* Bottom Nav */}
            <div className="shell-foot flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => prevModule && onNavigate?.(prevModule.id)}
                    disabled={!prevModule}
                >
                    <Icon icon={ChevronLeft} />
                    Previous
                </Button>
                <span className="me-auto type-caption text-text-2">
                    {currentIndex >= 0 ? `${currentIndex + 1} of ${moduleSections.length}` : null}
                </span>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => nextModule && onNavigate?.(nextModule.id)}
                    disabled={!nextModule}
                >
                    Next module
                    <Icon icon={ChevronRight} />
                </Button>
            </div>

            <Dialog open={showRegenConfirm} onOpenChange={setShowRegenConfirm}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>Regenerate this module?</DialogTitle>
                        <DialogDescription>Your other modules will not change.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose>Cancel</DialogClose>
                        <Button onClick={handleRegenerate}>Regenerate module</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

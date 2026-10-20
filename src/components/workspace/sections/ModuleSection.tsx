"use client";

import { useState, useEffect, useMemo } from "react";
import type { ModuleSection as ModuleSectionType, Section, Task, Roadmap, Resource } from "@/types";
import SmartEmbed from "@/components/shared/SmartEmbed";
import { getAiProviderInvalidKeyMessage } from "@/lib/ai-config";
import { getActiveApiKey, getActiveModel, getUserConfig } from "@/lib/userConfig";
import { CheckCircle2, Clock, ChevronRight, BookOpen, Video, ListTodo, FileText, X, Navigation, Circle, RefreshCw, BarChart2, Target, Link2, Wrench, Code2, GraduationCap, Paperclip } from "lucide-react";

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
    const availableTabs: { id: TabType; label: string; icon: React.ReactNode }[] = useMemo(() => {
        const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [];
        if (hasOverview) tabs.push({ id: 'overview', label: 'Overview', icon: <BookOpen size={14} /> });
        if (tasks.length > 0) tabs.push({ id: 'tasks', label: 'Tasks', icon: <ListTodo size={14} /> });
        if (resources.length > 0) tabs.push({ id: 'resources', label: 'Resources', icon: <FileText size={14} /> });
        if (videos.length > 0) tabs.push({ id: 'videos', label: 'Videos', icon: <Video size={14} /> });
        if (canGenerateQuiz) tabs.push({ id: 'quiz', label: 'Quiz', icon: <Target size={14} /> });
        tabs.push({ id: 'notes', label: 'Notes', icon: <FileText size={14} /> });
        return tabs;
    }, [canGenerateQuiz, hasOverview, resources.length, tasks.length, videos.length]);

    const [activeTab, setActiveTab] = useState<TabType>(availableTabs[0].id);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(videos.length > 0 ? videos[0].id : null);
    const [sidePanelResource, setSidePanelResource] = useState<Resource | null>(null);

    const [showRegenConfirm, setShowRegenConfirm] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenError, setRegenError] = useState("");
    const [focusedTaskIdx, setFocusedTaskIdx] = useState(-1);

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

            const res = await fetch("/api/parse-roadmap", {
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
        } catch (e) {
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
            const response = await fetch("/api/quiz/generate", {
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
                const message = payload.error === "insufficient_credits"
                    ? "Not enough credits to generate a quiz. Upgrade or use your own provider key in Settings."
                    : "Failed to generate a quiz for this module.";

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

    const resourceTypeIcon = (type: string) => {
        switch (type) {
            case "video": return <Video size={18} />;
            case "doc": return <FileText size={18} />;
            case "pdf": return <BookOpen size={18} />;
            case "link": return <Link2 size={18} />;
            case "code": return <Code2 size={18} />;
            case "tool": return <Wrench size={18} />;
            case "course": return <GraduationCap size={18} />;
            case "book": return <BookOpen size={18} />;
            default: return <Paperclip size={18} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-obsidian rounded-2xl border border-border overflow-hidden animate-fade-in relative">
            {/* Module Top Header */}
            <div className="px-8 pt-8 pb-6 border-b border-border bg-obsidian-surface/30">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center shrink-0">
                            <span className="font-sans-display text-[12px] uppercase tracking-widest text-indigo-400 font-bold">Mod</span>
                            <span className="font-display text-2xl text-indigo-300">{String(currentIndex + 1).padStart(2, "0")}</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                {data.estimatedTime && (
                                    <span className="font-sans-display text-[12px] uppercase tracking-[0.2em] text-text-secondary">
                                        <Clock size={12} className="mr-1 inline-flex" /> {data.estimatedTime}
                                    </span>
                                )}
                                <span className="font-sans-display text-[12px] uppercase tracking-widest text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                                    {taskPercent}% Complete
                                </span>
                            </div>
                            <h2 className="font-display font-light text-2xl sm:text-3xl text-white tracking-tight">
                                {section.title}
                            </h2>
                        </div>
                    </div>
                    {section.metadata && (
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-text-secondary/70">
                            {section.metadata.estimatedDuration && (
                                <span className="flex items-center gap-1.5">
                                    <Clock size={12} />
                                    {section.metadata.estimatedDuration}
                                </span>
                            )}
                            {section.metadata.difficulty && (
                                <span className="flex items-center gap-1.5">
                                    <BarChart2 size={12} />
                                    <span className={`px-1.5 py-0.5 rounded-sm font-medium ${
                                        section.metadata.difficulty === 'beginner' ? 'bg-emerald-500/10 text-emerald-400' :
                                        section.metadata.difficulty === 'intermediate' ? 'bg-amber-500/10 text-amber-400' :
                                        section.metadata.difficulty === 'advanced' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white'
                                    }`}>
                                        {section.metadata.difficulty.charAt(0).toUpperCase() + section.metadata.difficulty.slice(1)}
                                    </span>
                                </span>
                            )}
                            {section.metadata.keyOutcome && (
                                <span className="flex items-center gap-1.5">
                                    <Target size={12} />
                                    {section.metadata.keyOutcome}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative">
                            <button
                                onClick={() => setShowRegenConfirm(!showRegenConfirm)}
                                className="shrink-0 flex items-center justify-center w-11 h-11 rounded-lg transition-all bg-obsidian-elevated text-text-secondary border border-border-subtle hover:border-indigo-500/50 hover:text-indigo-300"
                                title="Regenerate Module"
                            >
                                <RefreshCw size={18} className={isRegenerating ? "animate-spin" : ""} />
                            </button>
                            {showRegenConfirm && (
                                <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-obsidian-elevated border border-border rounded-lg shadow-xl z-50 animate-in fade-in zoom-in duration-200">
                                    <p className="text-sm text-text-primary mb-3">Regenerate just this module? Your other modules will not change.</p>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowRegenConfirm(false)} className="px-3 py-1.5 text-xs text-text-secondary hover:text-white transition-colors">Cancel</button>
                                        <button onClick={handleRegenerate} className="px-3 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded font-medium transition-colors">Confirm</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={toggleModuleComplete}
                        className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-lg font-sans-display text-xs uppercase tracking-widest font-bold transition-all ${data.completed
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-obsidian-elevated text-text-secondary border border-border-subtle hover:border-indigo-500/50 hover:text-indigo-300"
                            }`}
                    >
                        {data.completed ? <><CheckCircle2 size={16} /> Mark Incomplete</> : <><Circle size={16} /> Mark Complete</>}
                    </button>
                </div>
                </div>
                {regenError && (
                    <div className="px-8 pb-4 text-red-400 text-sm">{regenError}</div>
                )}
                {isRegenerating && (
                    <div className="absolute inset-0 z-40 bg-obsidian/50 backdrop-blur-sm flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <RefreshCw size={24} className="text-indigo-400 animate-spin" />
                            <span className="text-sm font-medium text-white">Regenerating module...</span>
                        </div>
                    </div>
                )}
                {/* Tab Bar */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mt-8 border-b border-border pb-px">
                    {availableTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSidePanelResource(null); }}
                            className={`flex items-center gap-2 px-5 py-3 font-sans-display text-xs uppercase tracking-[0.15em] border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                                : "border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5"
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto w-full relative">
                {/* 1. Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="p-8 max-w-4xl animate-fade-in space-y-10">
                        {data.description && (
                            <section>
                                <h3 className="font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border pb-2">Description</h3>
                                <p className="font-body text-text-secondary text-lg leading-relaxed">
                                    {data.description}
                                </p>
                            </section>
                        )}

                        {objectives.length > 0 && (
                            <section>
                                <h3 className="font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border pb-2">Learning Objectives</h3>
                                <div className="space-y-3">
                                    {objectives.map((obj, i) => (
                                        <div key={i} className="flex items-start gap-4">
                                            <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex flex-col items-center justify-center shrink-0 mt-0.5">
                                                <TargetIcon size={12} />
                                            </div>
                                            <p className="font-body text-text-primary leading-relaxed">{obj}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {data.concepts && (
                            <section>
                                <h3 className="font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border pb-2">Key Concepts</h3>
                                <div className="p-6 border border-border bg-obsidian-elevated/40 rounded-xl">
                                    <p className="font-body text-text-secondary leading-relaxed whitespace-pre-wrap">
                                        {data.concepts}
                                    </p>
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* 2. Tasks Tab */}
                {activeTab === 'tasks' && (
                    <div className="p-8 max-w-3xl animate-fade-in">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary">Action Items</h3>
                            <span className="font-sans-display text-[12px] uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                                {completedCount} / {totalCount} Completed
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1 bg-white/5 rounded-full mb-8 overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${taskPercent}%` }} />
                        </div>

                        <div className="space-y-3">
                            {tasks.map((task: Task) => (
                                <div key={task.id} className={`group border bg-obsidian-surface/40 hover:bg-obsidian-surface/80 rounded-xl transition-all overflow-hidden ${focusedTaskIdx === tasks.indexOf(task) ? 'border-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,0.5)]' : 'border-border hover:border-border-subtle'}`}>
                                    <button
                                        type="button"
                                        className="w-full flex items-start gap-4 p-5 text-left"
                                        onClick={() => toggleTask(task.id)}
                                    >
                                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all shrink-0 ${task.completed
                                            ? "bg-emerald-500 border-emerald-500 text-obsidian"
                                            : "border-white/20 group-hover:border-emerald-500/50"
                                            }`}>
                                            {task.completed && <CheckCircle2 size={16} />}
                                        </div>
                                        <span className={`font-body text-base leading-snug transition-colors ${task.completed ? "text-text-secondary line-through" : "text-text-primary"
                                            }`}>
                                            {task.title}
                                            {task.priority && (
                                                <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                                    task.priority === 'core' ? 'bg-indigo-500/10 text-indigo-400' :
                                                    task.priority === 'optional' ? 'bg-zinc-500/10 text-zinc-400' :
                                                    task.priority === 'advanced' ? 'bg-amber-500/10 text-amber-400' : ''
                                                }`}>
                                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                                </span>
                                            )}
                                            {task.estimatedTime && (
                                                <span className="ml-3 inline-flex items-center gap-1 text-[12px] text-text-secondary opacity-70">
                                                    <Clock size={12} />
                                                    {task.estimatedTime}
                                                </span>
                                            )}
                                        </span>
                                    </button>

                                    {/* Subtasks */}
                                    {(task.subtasks || []).length > 0 && (
                                        <div className="ml-10 mb-4 mr-5 border-l-2 border-border pl-4 space-y-1">
                                            {(task.subtasks || []).map((sub) => (
                                                <button
                                                    key={sub.id}
                                                    type="button"
                                                    className="w-full flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-all text-left group/sub"
                                                    onClick={() => toggleSubtask(task.id, sub.id)}
                                                >
                                                    <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-all shrink-0 ${sub.completed
                                                        ? "bg-emerald-500/80 border-emerald-500/80 text-obsidian"
                                                        : "border-white/15 group-hover/sub:border-emerald-500/50"
                                                        }`}>
                                                        {sub.completed && <CheckCircle2 size={10} />}
                                                    </div>
                                                    <span className={`text-sm font-body leading-snug ${sub.completed ? "text-text-secondary line-through" : "text-text-secondary group-hover/sub:text-text-primary"
                                                        }`}>
                                                        {sub.title}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Resources Tab */}
                {activeTab === 'resources' && (
                    <div className="flex h-full animate-fade-in relative overflow-hidden">
                        <div className={`p-8 flex-1 overflow-y-auto transition-all duration-300 ${sidePanelResource ? "pr-[400px]" : "pr-8"}`}>
                            <h3 className="font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary mb-8 border-b border-border pb-2">Course Materials</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {resources.map((res) => (
                                    <button
                                        key={res.id}
                                        onClick={() => setSidePanelResource(res)}
                                        className={`flex items-start gap-4 p-5 text-left border rounded-xl transition-all duration-200 hover:-translate-y-1 ${sidePanelResource?.id === res.id
                                            ? "border-indigo-500 bg-indigo-500/10 shadow-[0_4px_20px_rgba(99,102,241,0.2)]"
                                            : "border-border-subtle bg-obsidian-surface/40 hover:border-white/20 hover:bg-obsidian-surface/80"
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-white/5 border border-border-subtle flex items-center justify-center text-xl shrink-0">
                                            {resourceTypeIcon(res.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-display text-white text-lg truncate mb-1">{res.title}</h4>
                                            {res.description && <p className="text-text-secondary font-body text-sm line-clamp-2">{res.description}</p>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Resource Side Panel */}
                        <div className={`absolute top-0 right-0 h-full w-[400px] border-l border-border-subtle bg-obsidian-elevated/95 backdrop-blur-xl transition-transform duration-300 transform shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col ${sidePanelResource ? "translate-x-0" : "translate-x-full"
                            }`}>
                            {sidePanelResource && (
                                <>
                                    <div className="p-4 border-b border-border flex items-center justify-between bg-obsidian-surface">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{resourceTypeIcon(sidePanelResource.type)}</span>
                                            <h4 className="font-sans-display text-xs uppercase tracking-widest text-white truncate max-w-[250px] font-bold">
                                                {sidePanelResource.title}
                                            </h4>
                                        </div>
                                        <button
                                            onClick={() => setSidePanelResource(null)}
                                            className="p-1.5 hover:bg-white/10 rounded text-text-secondary hover:text-white"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                                        <div className="mb-4">
                                            <p className="text-text-secondary text-sm font-body mb-4">{sidePanelResource.description}</p>
                                            <a
                                                href={sidePanelResource.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 font-sans-display text-xs uppercase tracking-widest text-indigo-400 hover:text-white transition-colors"
                                            >
                                                Open in New Tab <Navigation size={12} />
                                            </a>
                                        </div>
                                        <div className="flex-1 rounded-xl overflow-hidden border border-border-subtle bg-black min-h-[300px]">
                                            <SmartEmbed url={sidePanelResource.url} title={sidePanelResource.title} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'quiz' && (
                    <div className="p-8 max-w-4xl animate-fade-in space-y-6">
                        <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary">Knowledge Check</h3>
                                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
                                    Turn this module into a short multiple-choice quiz based on its tasks, notes, glossary terms, and description.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleGenerateQuiz()}
                                disabled={isGeneratingQuiz}
                                className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-indigo-300 transition-colors hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RefreshCw size={14} className={isGeneratingQuiz ? "animate-spin" : ""} />
                                {quizData ? "Generate fresh quiz" : "Generate quiz"}
                            </button>
                        </div>

                        {quizError && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {quizError}
                            </div>
                        )}

                        {!quizData ? (
                            <div className="rounded-2xl border border-dashed border-border bg-obsidian-surface/30 p-8 text-center">
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
                                    <Target size={20} />
                                </div>
                                <h4 className="font-display text-2xl text-white">No quiz generated yet</h4>
                                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
                                    Generate a five-question review for this module when you want a fast checkpoint before moving on.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {quizSubmitted && quizScore !== null && (
                                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-5">
                                        <div className="font-sans-display text-[11px] uppercase tracking-[0.2em] text-indigo-300">Quiz Score</div>
                                        <div className="mt-2 font-display text-4xl text-white">
                                            {quizScore} / {quizData.questions.length}
                                        </div>
                                        <p className="mt-2 text-sm text-text-secondary">
                                            Your score is saved for today in this browser so you can review explanations without losing your answers.
                                        </p>
                                    </div>
                                )}

                                {quizData.questions.map((question, index) => {
                                    const selectedAnswer = selectedAnswers[question.id];
                                    const isCorrect = selectedAnswer === question.answerIndex;

                                    return (
                                        <div key={question.id} className="rounded-2xl border border-border bg-obsidian-surface/40 p-6">
                                            <div className="mb-4 flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="mb-2 font-sans-display text-[11px] uppercase tracking-[0.2em] text-text-secondary">
                                                        Question {index + 1}
                                                    </div>
                                                    <h4 className="font-display text-2xl leading-tight text-white">{question.prompt}</h4>
                                                </div>
                                                {quizSubmitted && (
                                                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em] ${
                                                        isCorrect
                                                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                            : "border-red-500/30 bg-red-500/10 text-red-300"
                                                    }`}>
                                                        {isCorrect ? "Correct" : "Review"}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                {question.choices.map((choice, choiceIndex) => {
                                                    const isSelected = selectedAnswer === choiceIndex;
                                                    const showCorrectAnswer = quizSubmitted && question.answerIndex === choiceIndex;

                                                    return (
                                                        <button
                                                            key={`${question.id}-${choiceIndex}`}
                                                            type="button"
                                                            onClick={() => handleQuizChoice(question.id, choiceIndex)}
                                                            disabled={quizSubmitted}
                                                            className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                                                                showCorrectAnswer
                                                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                                                                    : isSelected
                                                                        ? "border-indigo-500/40 bg-indigo-500/10 text-white"
                                                                        : "border-border bg-obsidian-light/60 text-text-primary hover:border-indigo-500/20 hover:bg-white/5"
                                                            } disabled:cursor-default`}
                                                        >
                                                            <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/20 text-[11px] font-bold uppercase">
                                                                {String.fromCharCode(65 + choiceIndex)}
                                                            </span>
                                                            {choice}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {quizSubmitted && (
                                                <div className="mt-4 rounded-xl border border-border bg-black/20 px-4 py-3 text-sm leading-relaxed text-text-secondary">
                                                    <span className="font-medium text-white">Explanation:</span> {question.explanation}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {!quizSubmitted && (
                                    <button
                                        type="button"
                                        onClick={handleQuizSubmit}
                                        disabled={quizData.questions.some((question) => selectedAnswers[question.id] === undefined)}
                                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Submit answers
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Videos Tab */}
                {activeTab === 'videos' && (
                    <div className="flex flex-col lg:flex-row h-full animate-fade-in">
                        {/* Video Player */}
                        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
                            {activeVideoId && (
                                <div className="max-w-4xl mx-auto space-y-6">
                                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-border-subtle shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-black">
                                        <SmartEmbed
                                            url={videos.find(v => v.id === activeVideoId)?.url || ""}
                                            title={videos.find(v => v.id === activeVideoId)?.title || "Video"}
                                        />
                                    </div>
                                    <div>
                                        <h3 className="font-display text-2xl text-white mb-2">{videos.find(v => v.id === activeVideoId)?.title}</h3>
                                        <p className="font-body text-text-secondary leading-relaxed bg-obsidian-surface/50 p-6 rounded-xl border border-border">
                                            {videos.find(v => v.id === activeVideoId)?.description}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Playlist Sidebar */}
                        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border bg-obsidian-surface/20 flex flex-col shrink-0 overflow-y-auto">
                            <div className="p-4 border-b border-border font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary sticky top-0 bg-obsidian-surface/90 backdrop-blur-md z-10">
                                Playlist
                            </div>
                            <div className="flex flex-col p-2 gap-1">
                                {videos.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => setActiveVideoId(v.id)}
                                        className={`flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all ${activeVideoId === v.id
                                            ? "bg-indigo-500/10 border border-indigo-500/20 shadow-inner"
                                            : "hover:bg-white/5 border border-transparent"
                                            }`}
                                    >
                                        <span className={`font-body text-sm line-clamp-2 ${activeVideoId === v.id ? "text-indigo-300" : "text-white"}`}>
                                            {v.title}
                                        </span>
                                        {v.duration && (
                                            <span className="font-sans-display text-[9px] uppercase tracking-widest text-text-secondary tabular-nums mt-1">
                                                <Clock size={10} className="mr-1 inline-flex" /> {v.duration}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. Notes Tab */}
                {activeTab === 'notes' && (
                    <div className="p-8 max-w-4xl h-full flex flex-col animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary">Module Notes</h3>
                            <span className="font-sans-display text-[12px] uppercase tracking-widest text-indigo-400 font-bold min-w-[80px] text-right">
                                {saveStatus}
                            </span>
                        </div>
                        <textarea
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            placeholder="Type your notes for this module here... Autosaves as you type."
                            className="flex-1 w-full bg-obsidian-surface/30 border border-border-subtle rounded-xl p-6 font-body text-text-primary text-base leading-relaxed placeholder:text-text-secondary/30 resize-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        />
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-obsidian-surface/50 shrink-0">
                <button
                    onClick={() => prevModule && onNavigate?.(prevModule.id)}
                    disabled={!prevModule}
                    className={`px-5 py-2.5 flex items-center gap-3 font-sans-display text-xs uppercase tracking-[0.15em] font-bold rounded-lg transition-all ${prevModule
                        ? "hover:bg-white/10 text-white"
                        : "opacity-30 cursor-not-allowed text-text-secondary"
                        }`}
                >
                    <ChevronRight size={14} className="rotate-180" />
                    Previous
                </button>
                <div className="flex gap-1">
                    {moduleSections.map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentIndex ? "bg-indigo-500" : "bg-white/20"}`} />
                    ))}
                </div>
                <button
                    onClick={() => nextModule && onNavigate?.(nextModule.id)}
                    disabled={!nextModule}
                    className={`px-5 py-2.5 flex items-center gap-3 font-sans-display text-xs uppercase tracking-[0.15em] font-bold rounded-lg transition-all ${nextModule
                        ? "hover:bg-indigo-500/10 text-indigo-400 border border-transparent hover:border-indigo-500/30"
                        : "opacity-30 cursor-not-allowed text-text-secondary"
                        }`}
                >
                    Next module
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}

function TargetIcon(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    );
}

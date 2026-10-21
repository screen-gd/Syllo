"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { Roadmap, Section, ModuleSection as ModuleSectionType, CalendarSection, SrsItem } from "@/types";
import { useProgress } from "@/hooks/useProgress";
import { useStreak } from "@/hooks/useStreak";
import { useAchievements, BadgeType, BADGES_CONFIG } from "@/hooks/useAchievements";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import ProgressRing from "@/components/shared/ProgressRing";
import SectionRenderer from "@/components/workspace/SectionRenderer";
import WorkspaceSplitView from "@/components/workspace/WorkspaceSplitView";
import ShareEmbedModal from "@/components/workspace/ShareEmbedModal";
import SettingsModal from "@/components/workspace/SettingsModal";
import SrsReviewModal from "@/components/workspace/SrsReviewModal";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Link, useNavigate } from "@tanstack/react-router";
import { SECTION_LABELS } from "@/lib/constants";
import { Search, Settings, Home, ArrowRight, CheckCircle2, Circle, LayoutDashboard, SearchCode, BookOpen, Video, ListTodo, Trophy, Layers, Calendar, Clock, Lock, Target, Flame, Info, Plus, Share, RefreshCw, HardDrive, BarChart2, HelpCircle, X, FileText, Braces, Printer, History, ChevronDown, Key } from "lucide-react";
import { exportAsMarkdown, exportAsJSON, exportAsPDF } from "@/lib/export";
import { saveVersion, getVersions } from "@/lib/versioning";
import { getWorkspacePersistence } from "@/lib/workspace-persistence";
import { getUserConfig } from "@/lib/userConfig";
import { getStorage } from "@/lib/storage";
import { seedSrsItems } from "@/lib/srs";

const LEGACY_WORKSPACE_ACCENT = "#6366f1";

interface WorkspaceShellProps {
    roadmap: Roadmap;
    onUpdateSection?: (sectionId: string, updater: (s: Section) => Section) => void;
    onUpdateRoadmap?: (updates: Partial<Roadmap>) => void;
    isEmbed?: boolean;
    isReadOnly?: boolean;
    onApiError?: (error: { message: string }) => void;
}

export default function WorkspaceShell({ roadmap, onUpdateSection, onUpdateRoadmap, isEmbed = false, isReadOnly = false, onApiError }: WorkspaceShellProps) {
    const [activeSectionId, setActiveSectionId] = useState<string>("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const progress = useProgress(roadmap);

    // Gamification Hooks
    const { currentStreak, isAtRisk, logActivity, tasksCompletedToday, tasksCompletedYesterday } = useStreak();
    const { unlockedBadges, unlockBadge, recentBadge, clearRecentBadge, getBadges } = useAchievements();
    const { sessionTimeMs, getModuleTime } = useTimeTracker(activeSectionId !== "dashboard" ? activeSectionId : undefined);
    const navigate = useNavigate();
    const [userConfig, setUserConfig] = useState<any>(null);
    const [srsItems, setSrsItems] = useState<SrsItem[]>([]);
    const [isSrsModalOpen, setIsSrsModalOpen] = useState(false);
    const persistence = getWorkspacePersistence();

    useEffect(() => {
        setUserConfig(getUserConfig());
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const seededItems = seedSrsItems(roadmap);
        const storedItems = persistence.getReviews(roadmap.id);

        const mergedItems = new Map(seededItems.map((item) => [item.id, item]));
        storedItems.forEach((item) => {
            mergedItems.set(item.id, item);
        });

        const nextItems = Array.from(mergedItems.values());
        persistence.saveReviews(roadmap.id, nextItems);
        setSrsItems(nextItems);
    }, [persistence, roadmap]);

    // Tour State
    const [tourStep, setTourStep] = useState(-1);
    const [tourTarget, setTourTarget] = useState<DOMRect | null>(null);

    // Quick Actions
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);

    // Keyboard Shortcuts Navigation
    useEffect(() => {
        const handleGlobalKeys = (e: KeyboardEvent) => {
            // Ignore if in input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (e.key === '[' || e.key === ']') {
                e.preventDefault();
                const mods = roadmap.sections.filter((s) => s.type === "module" || s.type === "milestones");
                const currentIdx = mods.findIndex(m => m.id === activeSectionId);
                if (currentIdx === -1) {
                    if (mods.length > 0) setActiveSectionId(mods[0].id);
                    return;
                }

                if (e.key === '[' && currentIdx > 0) {
                    setActiveSectionId(mods[currentIdx - 1].id);
                } else if (e.key === ']' && currentIdx < mods.length - 1) {
                    setActiveSectionId(mods[currentIdx + 1].id);
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeys);
        return () => window.removeEventListener('keydown', handleGlobalKeys);
    }, [activeSectionId, roadmap.sections]);

    // Share & Embed Modal
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [versions, setVersions] = useState<any[]>([]);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [versionToRestore, setVersionToRestore] = useState<any | null>(null);

    useEffect(() => {
        if (roadmap?.id) {
            setVersions(getVersions(roadmap.id));
        }
    }, [roadmap?.id]);

    // Settings Modal
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);

    const branding = roadmap.branding;
    // A workspace may carry its own accent. "#6366f1" was the old default that
    // the branding modal saved for everyone, so it counts as no choice.
    const customAccent =
        branding?.accentColor && branding.accentColor.toLowerCase() !== LEGACY_WORKSPACE_ACCENT ? branding.accentColor : null;
    const workspaceTitle = branding?.customTitle || roadmap.title;
    const logoUrl = branding?.logoUrl;
    const hideWatermark = branding?.hideWatermark || false;

    const checkTour = useCallback(() => {
        if (!localStorage.getItem("zns_tour_done")) {
            setTimeout(() => setTourStep(0), 1000);
        }
    }, []);

    useEffect(() => {
        checkTour();
    }, [checkTour]);

    // Track previous completion count to detect new completions
    const prevCompletedTasks = useRef(progress.completedTasks);
    // Track module completion states to detect newly finished modules
    const prevModuleCompletion = useRef<Record<string, boolean>>({});

    const handleNextTourStep = () => {
        if (tourStep === 2) {
            // Navigate to first module, then advance tour
            const firstMod = moduleSections[0];
            if (firstMod) {
                onNavigate(firstMod.id);
                setTimeout(() => setTourStep(3), 500); // give it time to render Mod and button
            } else {
                endTour();
            }
        } else if (tourStep === 3) {
            endTour();
        } else {
            setTourStep(tourStep + 1);
        }
    };

    const endTour = () => {
        localStorage.setItem("zns_tour_done", "true");
        setTourStep(-1);
    };

    // Keep spotlight rect updated
    useEffect(() => {
        if (tourStep < 0) return;
        const ids = ["tour-sidebar", "tour-progress", "tour-first-module", "tour-mark-complete"];
        const id = ids[tourStep];
        const el = document.getElementById(id);

        if (!el) return;

        const updateRect = () => {
            setTourTarget(el.getBoundingClientRect());
        };

        el.classList.add("relative", "z-[60]");
        updateRect();
        const resizeObserver = new ResizeObserver(updateRect);
        resizeObserver.observe(el);
        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect, true);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect, true);
            el.classList.remove("relative", "z-[60]");
        };
    }, [tourStep, activeSectionId]);

    const getModuleProgress = (section: Section): number => {
        if (section.type === "module") {
            const ms = section as ModuleSectionType;
            if (ms.data.completed) return 100;
            const tasks = ms.data.tasks || [];
            let total = 0;
            let done = 0;
            for (const task of tasks) {
                total++;
                if (task.completed) done++;
                for (const sub of task.subtasks || []) {
                    total++;
                    if (sub.completed) done++;
                }
            }
            if (total === 0) return 0;
            return Math.round((done / total) * 100);
        }
        return 0;
    };

    const moduleSections = roadmap.sections.filter((s) => s.type === "module" || s.type === "milestones");

    // Achievement triggers
    useEffect(() => {
        // Daily Activity Check & Explorer
        try {
            const workspaces = getStorage().getRoadmaps();
            if (Array.isArray(workspaces) && workspaces.length >= 3) {
                unlockBadge("explorer");
            }
        } catch {
            // Ignore parse errors
        }

        // Detect new task completion
        if (progress.completedTasks > prevCompletedTasks.current) {
            const tasksCompletedNow = progress.completedTasks - prevCompletedTasks.current;
            logActivity(true); // Log as task completion

            // First Step
            if (progress.completedTasks >= 1) {
                unlockBadge("first_step");
            }

            // On A Roll
            if (currentStreak >= 3) {
                unlockBadge("on_a_roll");
            }
        }
        prevCompletedTasks.current = progress.completedTasks;

        // Detect module completion
        let anyModuleCompleted = false;
        moduleSections.forEach(mod => {
            const isCompleted = getModuleProgress(mod) === 100;
            const wasCompleted = prevModuleCompletion.current[mod.id];

            if (isCompleted && !wasCompleted) {
                anyModuleCompleted = true;

                // Track start time for Speed Learner
                const learningRecord = persistence.getLearningRecord();
                const startTime = learningRecord.moduleStartedAt[mod.id];
                if (startTime) {
                    const hoursPassed = (Date.now() - startTime) / (1000 * 60 * 60);
                    if (hoursPassed < 24) {
                        unlockBadge("speed_learner");
                    }
                }
            } else if (!isCompleted && !wasCompleted && getModuleProgress(mod) > 0) {
                // Record start time if not recorded
                const learningRecord = persistence.getLearningRecord();
                if (!learningRecord.moduleStartedAt[mod.id]) {
                    persistence.saveLearningRecord({ ...learningRecord, moduleStartedAt: { ...learningRecord.moduleStartedAt, [mod.id]: Date.now() } });
                }
            }

            prevModuleCompletion.current[mod.id] = isCompleted;
        });

        if (anyModuleCompleted) {
            unlockBadge("module_master");
        }

        // Course Complete
        if (progress.overall === 100 && progress.totalTasks > 0) {
            unlockBadge("course_complete");
        }

    }, [progress, currentStreak, logActivity, moduleSections, persistence, unlockBadge]);

    // Resource tracking for Deep Diver
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a');
            if (link && link.target === '_blank') {
                const clickedResources = JSON.parse(sessionStorage.getItem('zns_clicked_resources') || '[]');
                if (!clickedResources.includes(link.href)) {
                    clickedResources.push(link.href);
                    sessionStorage.setItem('zns_clicked_resources', JSON.stringify(clickedResources));
                    if (clickedResources.length >= 5) {
                        unlockBadge("deep_diver");
                    }
                }
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [unlockBadge]);

    // Keyboard shortcut for sidebar toggle
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "\\") {
                e.preventDefault();
                setSidebarOpen(prev => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const isEmptySection = (section: Section): boolean => {
        if (section.type === "progress") return false;
        if (section.type === "notes") return false;

        if (section.type === "module") {
            const md = (section as ModuleSectionType).data;
            if (!md) return true;
            return !md.description && !md.concepts &&
                (!md.tasks || md.tasks.length === 0) &&
                (!md.resources || md.resources.length === 0) &&
                (!md.videos || md.videos.length === 0) &&
                (!md.objectives || md.objectives.length === 0);
        }

        if (section.type === "custom") {
            return !section.data || !section.data.items || section.data.items.length === 0;
        }

        return false; // we no longer hide anything
    };

    const validSections = roadmap.sections;
    const activeSection = validSections.find((s) => s.id === activeSectionId);
    const utilitySections = validSections.filter((s) => s.type !== "module" && s.type !== "milestones" && s.type !== "progress");

    // Check for AI generation quality (fewer than 3 sections total, or minimal data)
    // Roadmap generally has progress/calendar by default plus modules. If less than let's say 4 sections total.
    const isLowQuality = roadmap.sections.length <= 3;

    const getMotivationalMessage = (percent: number) => {
        if (percent === 0) return "Just getting started 🚀";
        if (percent < 25) return "Off to a great start! 🌱";
        if (percent < 50) return "Building momentum 🔥";
        if (percent < 75) return "More than halfway there! ⭐";
        if (percent < 100) return "Almost complete! 💪";
        return "Course complete! 🎉";
    };

    const firstIncompleteModule = moduleSections.find(m => getModuleProgress(m) < 100) || moduleSections[0];

    // Stats for Dashboard
    const totalModules = moduleSections.length;
    const totalResources = validSections.reduce((acc, s) => {
        if (s.type === "module") return acc + ((s as ModuleSectionType).data.resources?.length || 0);
        if (s.type === "resources") return acc + (s as any).data?.length || 0;
        return acc;
    }, 0);
    const totalVideos = validSections.reduce((acc, s) => {
        if (s.type === "module") return acc + ((s as ModuleSectionType).data.videos?.length || 0);
        if (s.type === "videos") return acc + (s as any).data?.length || 0;
        return acc;
    }, 0);

    const getSectionIcon = (type: string, percent: number) => {
        if (type === "module") {
            if (percent === 100) return <CheckCircle2 size={16} className="text-accent" />;
            if (percent > 0) return <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />;
            return <Circle size={16} className="text-text-soft" />;
        }
        switch (type) {
            case "milestones": return "🏁";
            case "tasks": return "✅";
            case "progress": return "📊";
            case "resources": return "📚";
            case "videos": return "🎥";
            case "calendar": return "📅";
            case "notes": return "📝";
            case "glossary": return "📖";
            case "submissions": return "📤";
            default: return "🔧";
        }
    };

    const onNavigate = (id: string) => {
        setActiveSectionId(id);
        if (window.innerWidth < 1024) setSidebarOpen(false);
    };

    const handleResetProgress = () => {
        const freshSections = roadmap.sections.map((section) => {
            if (section.type === "module") {
                return {
                    ...section,
                    data: {
                        ...section.data,
                        completed: false,
                        tasks: (section.data.tasks || []).map((task) => ({
                            ...task,
                            completed: false,
                            subtasks: (task.subtasks || []).map((subtask) => ({ ...subtask, completed: false })),
                        })),
                    },
                };
            }

            return section;
        });

        onUpdateRoadmap?.({ sections: freshSections });
        setIsResetDialogOpen(false);
        window.location.reload();
    };

    const handleRestoreVersion = () => {
        if (!versionToRestore) return;

        saveVersion(roadmap);
        const restored = { ...roadmap, sections: versionToRestore.sections };
        onUpdateRoadmap?.(restored);
        setVersionToRestore(null);
        setShowVersionHistory(false);
        window.location.reload();
    };

    // Calculate intelligent insights
    const mostTimeSpentModule = useMemo(() => {
        let maxTime = 0;
        let maxMod: Section | null = null;
        moduleSections.forEach(m => {
            const time = getModuleTime(m.id);
            if (time > maxTime) {
                maxTime = time;
                maxMod = m;
            }
        });
        return { module: maxMod as Section | null, time: maxTime };
    }, [moduleSections, getModuleTime]);

    // Find deadlines
    const calendarEvents = useMemo(() => {
        const calSection = roadmap.sections.find(s => s.type === "calendar") as CalendarSection;
        if (!calSection || !calSection.data) return [];
        return [...calSection.data]
            .filter(e => !e.completed)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [roadmap]);

    const dueSrsItems = useMemo(() => {
        const now = Date.now();
        return srsItems
            .filter((item) => item.roadmapId === roadmap.id)
            .filter((item) => new Date(item.dueAt).getTime() <= now)
            .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
            .slice(0, 12);
    }, [roadmap.id, srsItems]);

    const formatTime = (ms: number) => {
        const hrs = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    };

    const handleSaveSrsItems = useCallback(async (reviewedItems: SrsItem[]) => {
        if (reviewedItems.length === 0) return;

        const reviewedLookup = new Map(reviewedItems.map((item) => [item.id, item]));

        setSrsItems((current) => {
            const merged = current.map((item) => reviewedLookup.get(item.id) ?? item);
            persistence.saveReviews(roadmap.id, merged);
            return merged;
        });

        try {
            await fetch("/api/srs/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: reviewedItems }),
            });
        } catch {
            // Signed-out users stay local-first; sync failure is non-blocking here.
        }
    }, [persistence, roadmap.id]);

    const getUtilityIcon = (type: string) => {
        if (type === "milestones") return <Target size={16} aria-hidden="true" />;
        if (type === "tasks") return <ListTodo size={16} aria-hidden="true" />;
        if (type === "progress") return <BarChart2 size={16} aria-hidden="true" />;
        if (type === "resources") return <BookOpen size={16} aria-hidden="true" />;
        if (type === "videos") return <Video size={16} aria-hidden="true" />;
        if (type === "calendar") return <Calendar size={16} aria-hidden="true" />;
        if (type === "notes") return <FileText size={16} aria-hidden="true" />;
        if (type === "glossary") return <Braces size={16} aria-hidden="true" />;
        if (type === "submissions") return <Printer size={16} aria-hidden="true" />;

        switch (type) {
            case "milestones":
                return "🏁";
            case "tasks":
                return "✅";
            case "progress":
                return "📊";
            case "resources":
                return "📚";
            case "videos":
                return "🎥";
            case "calendar":
                return "📅";
            case "notes":
                return "📝";
            case "glossary":
                return "📖";
            case "submissions":
                return "📤";
            default:
                return "🔧";
        }
    };

    return (
        <div
            className="h-screen flex flex-col overflow-hidden bg-page"
            style={
                customAccent
                    ? ({ "--color-accent": customAccent, "--color-accent-strong": customAccent, "--workspace-accent": customAccent } as React.CSSProperties)
                    : ({ "--workspace-accent": "var(--color-accent)" } as React.CSSProperties)
            }
        >
            {/* Gamification Toast */}
            {recentBadge && (
                <div className="fixed bottom-6 right-6 z-50 animate-slide-up-fade flex items-center gap-4 bg-surface-muted border border-accent/30 p-4 rounded-2xl cursor-pointer" onClick={clearRecentBadge}>
                    <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/50 flex items-center justify-center text-2xl">
                        {recentBadge.icon}
                    </div>
                    <div>
                        <div className="font-display text-xs text-accent font-bold mb-1">Achievement Unlocked</div>
                        <div className="font-display text-text text-lg">{recentBadge.title}</div>
                    </div>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside
                    id="tour-sidebar"
                    className={`${sidebarOpen ? "w-64 sm:w-72" : "w-16"} shrink-0 border-r border-border bg-[var(--color-surface)] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-30 flex flex-col group`}
                >
                    {/* Header: Collapse Toggle */}
                    <div className="h-14 flex items-center px-4 border-b border-border">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface transition-colors text-text-muted hover:text-text shrink-0"
                            title="Toggle Sidebar (Ctrl+\\)"
                            aria-label="Toggle sidebar"
                        >
                            <span aria-hidden="true" className="text-sm font-semibold tracking-[-0.3em]">|||</span>
                            <span className="sr-only">Toggle sidebar</span>
                        </button>
                        {sidebarOpen && (
                            <div className="ml-3 flex items-center gap-2 truncate">
                                {logoUrl && (
                                    <>
                                        {/* next/image is not practical here because the logo URL is fully user-defined. */}
                                        <img src={logoUrl} alt="Logo" className="w-5 h-5 object-contain" />
                                    </>
                                )}
                                <div className="font-display text-xs text-text truncate font-bold">
                                    {workspaceTitle}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                        {/* Search & Mini-progress (Only shown when open) */}
                        {sidebarOpen && (
                            <div className="p-4 space-y-4">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <Input
                                        type="text"
                                        placeholder="Search workspace..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        aria-label="Search workspace"
                                        className="h-9 border-border bg-[var(--color-surface-subtle)] pl-9 pr-4 text-xs text-text placeholder:text-text-muted"
                                    />
                                </div>

                                <div className="rounded-md border border-border bg-[var(--color-surface-subtle)] p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-display text-[12px] text-text-muted">Total Progress</span>
                                        <span className="font-display text-[12px] text-accent font-bold">{progress.overall}%</span>
                                    </div>
                                    <div className="h-1 bg-surface rounded-full overflow-hidden">
                                        <div className="h-full bg-accent rounded-full transition-all duration-1000" style={{ width: `${progress.overall}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={`p-2 space-y-6 ${!sidebarOpen && 'mt-4'}`}>
                            {/* Dashboard Link */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => onNavigate("dashboard")}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 text-sm hover:bg-surface ${activeSectionId === "dashboard" ? "bg-accent/12 border-l-[3px] border-accent text-text font-medium font-medium" : "text-text-muted"
                                        } ${!sidebarOpen && 'justify-center'}`}
                                    title="Overview"
                                >
                                    <LayoutDashboard size={sidebarOpen ? 18 : 20} className="shrink-0" />
                                    {sidebarOpen && <span className="truncate">Overview</span>}
                                </button>
                            </div>

                            {/* Modules */}
                            {moduleSections.length > 0 && (
                                <div>
                                    {sidebarOpen && (
                                        <div className="font-display text-xs text-text-muted/50 mb-2 px-3">
                                            Modules
                                        </div>
                                    )}
                                    <nav className="space-y-1">
                                        {moduleSections.map((section, idx) => {
                                            const isActive = section.id === activeSectionId;
                                            const modulePercent = getModuleProgress(section);
                                            // Handle search filtering
                                            if (searchQuery && !section.title.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                                            return (
                                                <button
                                                    key={section.id}
                                                    type="button"
                                                    title={section.title}
                                                    className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-200 group ${isActive
                                                        ? "bg-accent/12 border-l-[3px] border-accent text-text font-medium"
                                                        : "border-l-[3px] border-transparent text-text-muted hover:text-text hover:bg-surface-subtle duration-150"
                                                        } ${!sidebarOpen && 'justify-center !px-0'}`}
                                                    onClick={() => onNavigate(section.id)}
                                                >
                                                    {sidebarOpen ? (
                                                        <>
                                                            <div className="w-6 shrink-0 flex items-center justify-center mr-2">
                                                                {getSectionIcon(section.type, modulePercent)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="block text-sm truncate">
                                                                    <span className="text-text-muted/50 mr-2 text-[12px] font-mono">{String(idx + 1).padStart(2, "0")}</span>
                                                                    {section.title}
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center relative overflow-hidden bg-page">
                                                            {/* Mini circular indicator when collapsed */}
                                                            <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
                                                                <circle cx="18" cy="18" r="16" fill="transparent" stroke="var(--color-obsidian-elevated)" strokeWidth="4" />
                                                                <circle cx="18" cy="18" r="16" fill="transparent" stroke={modulePercent === 100 ? "var(--color-success)" : "var(--color-accent)"} strokeWidth="4" strokeDasharray="100" strokeDashoffset={100 - modulePercent} />
                                                            </svg>
                                                            <span className="text-[12px] font-bold z-10">{idx + 1}</span>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </nav>
                                </div>
                            )}

                            {/* Tools / Utility */}
                            {utilitySections.length > 0 && sidebarOpen && (
                                <div>
                                    <div className="font-display text-xs text-text-muted/50 mb-2 px-3">
                                        Resources & Tools
                                    </div>
                                    <nav className="space-y-1">
                                        {utilitySections.map((section) => {
                                            const isActive = section.id === activeSectionId;
                                            const label = section.title || SECTION_LABELS[section.type] || section.type;
                                            if (searchQuery && !label.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                                            return (
                                                <button
                                                    key={section.id}
                                                    type="button"
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 text-sm hover:bg-surface ${isActive ? "text-accent font-medium bg-accent/5" : "text-text-muted hover:text-text"
                                                        }`}
                                                    onClick={() => onNavigate(section.id)}
                                                >
                                                    <span className="w-5 shrink-0 text-center opacity-70">
                                                        {getUtilityIcon(section.type)}
                                                        <span className="sr-only">{label}</span>
                                                    </span>
                                                    <span className="truncate">{label}</span>
                                                </button>
                                            );
                                        })}
                                    </nav>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Footer */}
                    <div className="mt-auto border-t border-border p-3 flex flex-col gap-2">
                        {sidebarOpen ? (
                            <>
                                {!isEmbed && (
                                    <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface transition-colors">
                                        <Home size={16} />
                                        <span>Back to Home</span>
                                    </Link>
                                )}
                                {!isEmbed && !isReadOnly && (
                                    <>
                                        <Link to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface transition-colors">
                                            <Settings size={16} />
                                            <span>Settings</span>
                                        </Link>
                                        {userConfig?.useCustomKey && (
                                            <div className="flex items-center gap-1.5 px-3 py-1 text-accent text-xs font-medium" title="Using your custom AI provider">
                                                <Key size={12} /> Custom API
                                            </div>
                                        )}
                                        {userConfig?.showProgressNotice !== false && (
                                            <div className="flex items-center justify-between px-3 py-1 mt-1 mb-1">
                                                <div className="flex items-center gap-1.5 text-text-muted opacity-70">
                                                    <HardDrive size={12} />
                                                    <span className="text-xs font-medium">Saved in this browser</span>
                                                </div>
                                                <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                                                    <AlertDialogTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="text-xs font-bold text-danger hover:text-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
                                                        >
                                                            Reset
                                                        </button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Reset all workspace progress?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This clears completion state for every module task and subtask in this workspace. The action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleResetProgress}>
                                                                Reset progress
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                {!isEmbed && (
                                    <Link to="/" className="flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors" title="Back to Home">
                                        <Home size={18} />
                                    </Link>
                                )}
                                {!isEmbed && !isReadOnly && (
                                    <>
                                        <Link to="/settings" className="flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors" title="Settings">
                                            <Settings size={18} />
                                        </Link>
                                        {userConfig?.useCustomKey && (
                                            <div className="flex items-center gap-1.5 text-accent text-xs font-medium" title="Using your custom AI provider">
                                                <Key size={10} />
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </aside>

                {/* Mobile overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-page/80 z-20 sm:hidden transition-opacity duration-300"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Main Content Area */}
                <main id="main-content" className="flex-1 overflow-y-auto relative bg-page flex flex-col">
                    {/* Workspace Header */}
                    {!isEmbed && !isReadOnly && (
                        <div className="sticky top-0 z-30 flex-shrink-0 border-b border-border bg-[var(--color-page)]/95 flex items-center justify-between px-6 py-3">
                            <div className="flex-1">
                                {/* Potential breadcrumbs or workspace specific title override here */}
                            </div>
                            <div className="flex items-center gap-3">
                                <ThemeToggle />
                                <button
                                    onClick={() => setShowShortcuts(!showShortcuts)}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-text-muted hover:text-text hover:bg-surface transition-colors border border-border"
                                    title="Keyboard Shortcuts"
                                    aria-label="Open keyboard shortcuts"
                                >
                                    <HelpCircle size={16} />
                                </button>
                                {showShortcuts && (
                                    <div className="absolute top-16 right-6 w-80 bg-surface-muted border border-border rounded-xl shadow-2xl z-50 animate-fade-in p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-display text-xs text-text font-bold">Keyboard Shortcuts</h3>
                                            <button
                                                onClick={() => setShowShortcuts(false)}
                                                className="text-text-muted hover:text-text"
                                                aria-label="Close keyboard shortcuts"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {[
                                                { k: 'J', d: 'Next task' },
                                                { k: 'K', d: 'Previous task' },
                                                { k: 'Space', d: 'Toggle task status' },
                                                { k: '[', d: 'Previous module' },
                                                { k: ']', d: 'Next module' }
                                            ].map(s => (
                                                <div key={s.k} className="flex items-center justify-between">
                                                    <span className="text-sm text-text-muted">{s.d}</span>
                                                    <kbd className="px-2 py-1 bg-page rounded border border-border text-xs font-mono text-text min-w-[24px] text-center">{s.k}</kbd>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsSrsModalOpen(true)}
                                    disabled={dueSrsItems.length === 0}
                                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-text-muted transition-colors hover:text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                                    title={dueSrsItems.length === 0 ? "No spaced repetition cards are due right now" : `Review ${dueSrsItems.length} spaced repetition cards`}
                                >
                                    <History size={14} />
                                    {dueSrsItems.length > 0 ? `Review ${dueSrsItems.length}` : "Review Cards"}
                                </button>
                                {/* Export Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-xs font-bold transition-colors border border-accent/30"
                                    >
                                        Export <ChevronDown size={12} />
                                    </button>
                                    {showExportMenu && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-surface-muted border border-border rounded-lg shadow-xl z-50 animate-in fade-in zoom-in duration-200 py-1">
                                            <button onClick={() => { exportAsMarkdown(roadmap); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-surface text-left">
                                                <FileText size={14} /> Download as Markdown
                                            </button>
                                            <button onClick={() => { exportAsJSON(roadmap); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-surface text-left">
                                                <Braces size={14} /> Download as JSON
                                            </button>
                                            <button onClick={() => { exportAsPDF(roadmap); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-surface text-left">
                                                <Printer size={14} /> Print / Save as PDF
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Version History */}
                                <button
                                    onClick={() => setShowVersionHistory(true)}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-text-muted hover:text-text hover:bg-surface transition-colors border border-border"
                                    title="Version History"
                                    aria-label="Open version history"
                                >
                                    <History size={16} />
                                </button>

                                <button
                                    onClick={() => setShareModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-xs font-bold transition-colors border border-accent/30"
                                >
                                    <Share size={14} />
                                    Share & Embed
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto relative bg-page">
                        {/* Banners */}
                        {isLowQuality && (
                            <div className="bg-accent/10 border-b border-accent/20 text-accent py-3 px-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm z-10 relative">
                                <span className="flex items-center gap-2">
                                    <Info size={16} aria-hidden="true" />
                                    Your content generated a minimal workspace. For richer results, try adding more detail to your content or use a longer guide.
                                </span>
                                <button
                                    onClick={() => navigate({ to: "/create" })}
                                    className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent font-bold rounded flex items-center gap-2 transition-colors whitespace-nowrap"
                                >
                                    Improve my content <ArrowRight size={14} />
                                </button>
                            </div>
                        )}
                        {isAtRisk && (
                            <div className="bg-accent/10 border-b border-accent/20 text-accent py-2 px-4 flex items-center justify-center gap-2 text-sm z-10 relative">
                                <Flame size={16} />
                                Your {currentStreak} day learning streak is at risk! Complete a task today to keep it going.
                            </div>
                        )}
                        {calendarEvents.some(e => {
                            const days = (new Date(e.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                            return days < 0 && !e.completed;
                        }) && (
                                <div className="bg-danger/10 border-b border-danger/20 text-danger py-2 px-4 flex items-center justify-center gap-2 text-sm">
                                    <Clock size={16} />
                                    You have overdue deadlines. Check your calendar.
                                </div>
                            )}

                        {activeSectionId === "dashboard" ? (
                            // COURSE DASHBOARD
                            <div className="animate-fade-in p-6 sm:p-10 lg:p-16 max-w-6xl mx-auto space-y-12">
                                {/* Dashboard Header */}
                                <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto relative">
                                    {/* Streak indicator right side */}
                                    {currentStreak > 0 && (
                                        <div className="absolute top-0 right-0 hidden md:flex items-center gap-2 bg-surface-muted border border-accent/30 text-accent px-4 py-2 rounded-full">
                                            <Flame size={18} className={isAtRisk ? "" : ""} />
                                            <span className="font-bold">{currentStreak} Day Streak</span>
                                        </div>
                                    )}
                                    <div className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-accent/30 bg-accent/10">
                                        <span className="font-display text-[12px] text-accent font-bold">
                                            {roadmap.mode} Course
                                        </span>
                                    </div>
                                    <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight text-text leading-[1.1]">
                                        {roadmap.title}
                                    </h1>
                                    {roadmap.summary && (
                                        <p className="font-body text-text-muted text-lg leading-relaxed">
                                            {roadmap.summary}
                                        </p>
                                    )}
                                    {roadmap.objectives && roadmap.objectives.length > 0 && (
                                        <div className="mt-8 text-left w-full bg-surface/40 border border-border rounded-2xl p-8 shadow-inner">
                                            <h3 className="font-display text-xs text-text-muted mb-6 flex items-center gap-2">
                                                <span className="w-4 h-[1px] bg-accent" />
                                                Learning Objectives
                                            </h3>
                                            <div className="grid sm:grid-cols-2 gap-4">
                                                {roadmap.objectives.map((obj, i) => (
                                                    <div key={i} className="flex items-start gap-4">
                                                        <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/30 text-accent flex flex-col items-center justify-center shrink-0 mt-0.5">
                                                            <SearchCode size={12} />
                                                        </div>
                                                        <p className="font-body text-text text-sm leading-relaxed">{obj}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Intelligent Insights Row */}
                                <div className="grid lg:grid-cols-3 gap-6">
                                    {/* Progress Ring & Continue */}
                                    <div id="tour-progress" className="lg:col-span-2 flex flex-col items-center justify-center bg-surface/30 border border-border rounded-2xl p-10 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-accent/5 to-transparent pointer-events-none" />

                                        <div className="flex flex-col sm:flex-row items-center gap-10">
                                            <ProgressRing percent={progress.overall} size={140} strokeWidth={8} className="" />

                                            <div className="text-center sm:text-left flex flex-col items-center sm:items-start">
                                                <h4 className="font-display text-base font-semibold text-text font-medium mb-2">{getMotivationalMessage(progress.overall)}</h4>
                                                <p className="text-sm text-text-muted mb-8 font-display">{progress.completedTasks} of {progress.totalTasks} Tasks Completed</p>

                                                <div className="flex flex-col gap-3 sm:flex-row">
                                                    <button
                                                        onClick={() => onNavigate(firstIncompleteModule.id)}
                                                        className="px-8 py-4 bg-text hover:bg-[#e6e6e6] text-page font-display text-xs font-medium rounded-full transition-all flex items-center gap-3 group"
                                                    >
                                                        Continue Learning
                                                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsSrsModalOpen(true)}
                                                        disabled={dueSrsItems.length === 0 || isReadOnly}
                                                        className="px-6 py-4 border border-border bg-surface-muted text-text font-display text-xs font-bold rounded-lg transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {dueSrsItems.length > 0 ? `Review ${dueSrsItems.length} Cards` : "No Cards Due"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Smart Insights Card */}
                                    <div className="flex flex-col gap-4">
                                        <div className="bg-surface/40 border border-border rounded-2xl p-6 flex-1">
                                            <h3 className="font-display text-xs text-text-muted mb-4 flex items-center gap-2">
                                                <Target size={14} className="text-accent" />
                                                Your Progress
                                            </h3>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-text-muted">Tasks Today</span>
                                                    <span className="text-sm font-bold text-text flex items-center gap-2">
                                                        {tasksCompletedToday}
                                                        {tasksCompletedToday > tasksCompletedYesterday && <span className="text-accent text-[12px]">↑</span>}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-text-muted">Tasks Yesterday</span>
                                                    <span className="text-sm text-text">{tasksCompletedYesterday}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-text-muted">Est. Remaining Time</span>
                                                    <span className="text-sm text-text">
                                                        {progress.completedTasks > 0 && progress.totalTasks > progress.completedTasks
                                                            ? formatTime((sessionTimeMs / progress.completedTasks) * (progress.totalTasks - progress.completedTasks))
                                                            : "-"}
                                                    </span>
                                                </div>
                                                <div className="h-[1px] bg-surface w-full my-2"></div>
                                                {mostTimeSpentModule.module && (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[12px] text-text-muted font-display">Most time spent on</span>
                                                        <span className="text-sm text-accent line-clamp-1">{mostTimeSpentModule.module.title}</span>
                                                        <span className="text-[12px] text-text-muted">{formatTime(mostTimeSpentModule.time)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {calendarEvents.length > 0 && (
                                            <div className="bg-surface/40 border border-border rounded-2xl p-6 flex-1">
                                                <h3 className="font-display text-xs text-text-muted mb-4 flex items-center gap-2">
                                                    <Calendar size={14} className="text-accent" />
                                                    Upcoming Deadlines
                                                </h3>
                                                <div className="space-y-3">
                                                    {calendarEvents.slice(0, 3).map(event => {
                                                        const days = (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                                                        let color = "text-accent bg-accent/10 border-accent/20";
                                                        if (days < 0) color = "text-text-muted bg-surface border-border";
                                                        else if (days < 3) color = "text-danger bg-danger/10 border-danger/20";
                                                        else if (days < 7) color = "text-accent bg-accent/10 border-accent/20";

                                                        return (
                                                            <div key={event.id} className="flex flex-col gap-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-base font-semibold text-text line-clamp-1">{event.title}</span>
                                                                    <span className={`text-xs  font-bold px-2 py-0.5 rounded border ${color}`}>
                                                                        {days < 0 ? 'Past' : `${Math.ceil(days)}d`}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[12px] text-text-muted">{new Date(event.date).toLocaleDateString()}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Stats Line */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: "Modules", value: totalModules, icon: <Layers size={18} /> },
                                        { label: "Tasks", value: progress.totalTasks, icon: <ListTodo size={18} /> },
                                        { label: "Resources", value: totalResources, icon: <BookOpen size={18} /> },
                                        { label: "Videos", value: totalVideos, icon: <Video size={18} /> },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-surface/40 border border-border rounded-xl p-5 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-accent">
                                                {stat.icon}
                                            </div>
                                            <div>
                                                <div className="font-display text-2xl text-text">{stat.value}</div>
                                                <div className="font-display text-xs text-text-muted">{stat.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Achievements Section */}
                                <div>
                                    <h3 className="font-display text-xs text-text-muted mb-6 flex items-center gap-2">
                                        <Trophy size={14} className="text-accent" />
                                        Achievements
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                                        {getBadges().map(badge => (
                                            <div
                                                key={badge.id}
                                                className={`relative flex flex-col items-center text-center p-4 rounded-xl border transition-all ${badge.unlockedAt
                                                    ? "bg-accent/10 border-accent/30 hover:bg-accent/20"
                                                    : "bg-surface border-border opacity-50 grayscale hover:grayscale-0"
                                                    }`}
                                                title={badge.description}
                                            >
                                                <div className="text-3xl mb-2">{badge.icon}</div>
                                                <div className="text-xs font-bold text-text leading-tight mb-1">{badge.title}</div>
                                                {!badge.unlockedAt && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-page/90 opacity-0 hover:opacity-100 transition-opacity rounded-xl p-2 z-10">
                                                        <Lock size={12} className="mb-1 text-text-muted" />
                                                        <span className="text-xs text-text-muted">{badge.description}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Module Grid */}
                                {moduleSections.length > 0 && (
                                    <div>
                                        <h3 className="font-display text-xs text-text-muted mb-6 flex items-center gap-2">
                                            <span className="w-4 h-[1px] bg-accent" />
                                            Course Modules
                                        </h3>
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {moduleSections.map((mod, idx) => {
                                                const modPercent = getModuleProgress(mod);
                                                const tasksCount = mod.type === "module" ? ((mod as ModuleSectionType).data.tasks || []).length : 0;
                                                const status = modPercent === 100 ? "Complete" : modPercent > 0 ? "In Progress" : "Not Started";

                                                return (
                                                    <button
                                                        key={mod.id}
                                                        id={idx === 0 ? "tour-first-module" : undefined}
                                                        onClick={() => onNavigate(mod.id)}
                                                        className="group relative flex flex-col items-start bg-surface/30 border border-border hover:border-accent/30 rounded-xl p-6 text-left transition-all hover:bg-surface/80 overflow-hidden"
                                                    >
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-accent/10 transition-colors" />

                                                        <div className="flex items-center justify-between w-full mb-4">
                                                            <span className="font-mono text-[12px] text-text-muted/50 group-hover:text-accent transition-colors">
                                                                MOD {String(idx + 1).padStart(2, "0")}
                                                            </span>
                                                            <span className={`font-display text-xs   px-2 py-1 rounded border ${status === "Complete" ? "border-accent/30 text-accent" :
                                                                status === "In Progress" ? "border-accent/30 text-accent" :
"border-border text-text-muted"
                                                                }`}>
                                                                {status}
                                                            </span>
                                                        </div>

                                                        <h4 className="font-display text-lg text-text mb-2 line-clamp-2">
                                                            {mod.title}
                                                        </h4>

                                                        {mod.type === "module" && (mod as ModuleSectionType).data.description && (
                                                            <p className="text-text-muted text-sm line-clamp-2 mb-6 font-body">
                                                                {(mod as ModuleSectionType).data.description}
                                                            </p>
                                                        )}

                                                        <div className="mt-auto w-full">
                                                            <div className="flex items-center justify-between font-display text-xs text-text-muted mb-2">
                                                                <span>{tasksCount} tasks</span>
                                                                <span>{modPercent}%</span>
                                                            </div>
                                                            <div className="h-1 bg-surface rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-700 ${modPercent === 100 ? "bg-accent" : "bg-accent"}`}
                                                                    style={{ width: `${modPercent}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : activeSection?.type === "module" || activeSection?.type === "milestones" ? (
                            <div className="flex-1 w-full relative z-10 min-h-full">
                                    <WorkspaceSplitView
                                        roadmap={roadmap}
                                        activeModuleId={activeSection.id}
                                        onUpdateSubtask={(moduleId, taskId, subtaskId) => {
                                            onUpdateSection?.(moduleId, (s) => {
                                                const ms = s as ModuleSectionType;
                                                return {
                                                    ...ms,
                                                    data: {
                                                        ...ms.data,
                                                        tasks: (ms.data.tasks || []).map((t: any) =>
                                                            t.id === taskId
                                                                ? {
                                                                    ...t,
                                                                    subtasks: (t.subtasks || []).map((st: any) =>
                                                                        st.id === subtaskId ? { ...st, completed: !st.completed } : st
                                                                    ),
                                                                }
                                                                : t
                                                        ),
                                                    },
                                                };
                                            });
                                        }}
                                        onUpdateTask={(moduleId, taskId) => {
                                            onUpdateSection?.(moduleId, (s) => {
                                                const ms = s as ModuleSectionType;
                                                return {
                                                    ...ms,
                                                    data: {
                                                        ...ms.data,
                                                        tasks: (ms.data.tasks || []).map((t: any) =>
                                                            t.id === taskId ? { ...t, completed: !t.completed } : t
                                                        ),
                                                    },
                                                };
                                            });
                                        }}
                                        onUpdateModule={(moduleId) => {
                                            onUpdateSection?.(moduleId, (s) => {
                                                const ms = s as ModuleSectionType;
                                                const isCompleted = !ms.data.completed;
                                                return {
                                                    ...ms,
                                                    data: {
                                                        ...ms.data,
                                                        completed: isCompleted,
                                                        tasks: isCompleted ? (ms.data.tasks || []).map((t: any) => ({
                                                            ...t,
                                                            completed: true,
                                                            subtasks: (t.subtasks || []).map((st: any) => ({ ...st, completed: true }))
                                                        })) : ms.data.tasks
                                                    },
                                                };
                                            });
                                        }}
                                    />
                            </div>
                        ) : activeSection ? (
                            <div className="p-6 sm:p-8 lg:p-12 max-w-5xl mx-auto relative z-10 min-h-full">
                                    <SectionRenderer
                                        section={activeSection}
                                        roadmap={roadmap}
                                        onUpdate={(updater) => onUpdateSection?.(activeSection.id, updater)}
                                        onApiError={onApiError}
                                    />
                            </div>
                        ) : null}
                    </div>
                </main>
            </div>

            {/* QUICK ACTIONS FAB */}
            {!isReadOnly && (
                <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
                    <div className={`flex flex-col items-end gap-2 transition-all duration-300 origin-bottom right-0 ${quickActionsOpen ? " opacity-100 pointer-events-auto" : " opacity-0 pointer-events-none"}`}>
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-surface-muted border border-border rounded-full text-sm font-bold shadow-lg hover:border-accent/50 hover:bg-accent/10 hover:text-accent transition-colors">
                            <Plus size={16} /> Add Note
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-surface-muted border border-border rounded-full text-sm font-bold shadow-lg hover:border-accent/50 hover:bg-accent/10 hover:text-accent transition-colors">
                            <Plus size={16} /> Add Resource
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-surface-muted border border-border rounded-full text-sm font-bold shadow-lg hover:border-accent/50 hover:bg-accent/10 hover:text-accent transition-colors">
                            <Plus size={16} /> Add Video
                        </button>
                        <button
                            onClick={() => setShareModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-surface-muted border border-border rounded-full text-sm font-bold shadow-lg hover:border-accent/50 hover:bg-accent/10 hover:text-accent transition-colors"
                        >
                            <Share size={16} /> Share Workspace
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-surface-muted border border-border rounded-full text-sm font-bold shadow-lg hover:border-warning/50 hover:bg-warning/10 hover:text-warning transition-colors">
                            <RefreshCw size={16} /> Regenerate Workspace
                        </button>
                    </div>
                    <button
                        onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                        className="w-14 h-14 bg-text rounded-full flex items-center justify-center text-page shadow-xl hover:bg-[#e6e6e6] transition-all duration-300"
                    >
                        <Plus className={`transition-transform duration-300 ${quickActionsOpen ? "rotate-45" : ""}`} size={24} />
                    </button>
                </div>
            )}

            <SrsReviewModal
                isOpen={isSrsModalOpen}
                items={dueSrsItems}
                onClose={() => setIsSrsModalOpen(false)}
                onSave={handleSaveSrsItems}
            />

            {/* TOUR OVERLAY */}
            {tourStep >= 0 && (
                <div className="fixed inset-0 z-[50] pointer-events-none">
                    <div className="absolute inset-0 bg-black/60 transition-opacity duration-300 pointer-events-auto" />

                    {tourTarget && (
                        <div
                            className="absolute bg-surface-muted border border-border rounded-2xl p-6 shadow-2xl z-[70] animate-scale-in flex flex-col pointer-events-auto w-72"
                            style={{
                                top: tourStep === 0 ? Math.max(20, tourTarget.top) // Sidebar
                                    : tourStep === 1 ? tourTarget.bottom + 20 // Progress ring
                                        : tourStep === 2 ? tourTarget.bottom + 20 // First module
                                            : Math.max(20, tourTarget.bottom + 20), // Mark complete
                                left: tourStep === 0 ? tourTarget.right + 20 // Sidebar
                                    : tourStep === 1 || tourStep === 2 ? Math.max(20, tourTarget.left + (tourTarget.width / 2) - 144)
                                        : Math.min(window.innerWidth - 300, tourTarget.left),
                                transition: 'top 0.4s ease, left 0.4s ease'
                            }}
                        >
                            <h4 className="font-display text-base font-semibold text-text mb-2 text-accent-strong drop-shadow-sm">
                                {tourStep === 0 ? "These are your course modules" :
                                    tourStep === 1 ? "Your completion is tracked here" :
                                        tourStep === 2 ? "Click any module to start learning" :
"Mark modules done as you go"}
                            </h4>
                            <p className="font-body text-text-muted text-sm mb-6">
                                {tourStep === 0 ? "Navigate between different sections, tools, and materials here." :
                                    tourStep === 1 ? "Watch this ring fill up as you complete tasks throughout the course." :
                                        tourStep === 2 ? "Dive into your first generated learning module." :
"Check this off when you finish all tasks to boost your progress."}
                            </p>
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                                <button onClick={endTour} className="text-xs text-text-muted hover:text-text transition-colors">End Tour</button>
                                <button onClick={handleNextTourStep} className="px-5 py-2 rounded-full bg-text hover:bg-[#e6e6e6] text-page font-medium text-xs">
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Version History Drawer */}
            {showVersionHistory && (
                <div className="fixed inset-0 z-50 flex justify-end bg-page/50" onClick={() => setShowVersionHistory(false)}>
                    <div className="w-full max-w-md bg-page border-l border-border h-full shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-page z-10">
                            <h3 className="font-display text-xs text-text font-bold">Version History</h3>
                            <button
                                onClick={() => setShowVersionHistory(false)}
                                aria-label="Close version history"
                                className="text-text-muted hover:text-text"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {versions.length === 0 ? (
                                <p className="text-text-muted text-sm text-center py-8">No saved versions yet.</p>
                            ) : (
                                versions.map((v, i) => (
                                    <div key={i} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-text">{v.label}</span>
                                            <button
                                                onClick={() => setVersionToRestore(v)}
                                                className="text-xs bg-accent/10 text-accent hover:bg-accent/20 px-2 py-1 rounded border border-accent/30"
                                            >
                                                Restore
                                            </button>
                                        </div>
                                        <div className="text-xs text-text-muted">
                                            {v.sections?.length || 0} modules • {new Date(v.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog
                open={Boolean(versionToRestore)}
                onOpenChange={(open) => {
                    if (!open) {
                        setVersionToRestore(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore saved version?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your current progress will be saved as a new version before this snapshot is restored.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestoreVersion}>
                            Restore version
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modals */}
            <ShareEmbedModal
                roadmap={roadmap}
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                onUpdateRoadmap={onUpdateRoadmap}
            />
            <SettingsModal
                roadmap={roadmap}
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                onUpdateBranding={(branding) => onUpdateRoadmap?.({ branding })}
            />

            {/* Watermark */}
            {!hideWatermark && (
                <div className="fixed bottom-3 right-3 z-50 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-surface border border-border rounded-md">
                        <span className="text-xs tracking-tighter text-text-muted font-bold">Powered by</span>
                        <span className="text-xs text-text font-semibold">ZNS <span className="text-accent">NEXUS</span></span>
                    </div>
                </div>
            )}
        </div>
    );
}

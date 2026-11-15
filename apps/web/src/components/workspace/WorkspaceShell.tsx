"use client";
import { fetchPrivateApi } from "@/lib/private-api-fetch";


import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { Roadmap, Section, ModuleSection as ModuleSectionType, CalendarSection, SrsItem } from "@/types";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useProgress } from "@/hooks/useProgress";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import MaterialBar from "@/components/syllo/MaterialBar";
import { springs } from "@/components/syllo/motion";
import { useStreak } from "@/hooks/useStreak";
import { useAchievements } from "@/hooks/useAchievements";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import SectionRenderer from "@/components/workspace/SectionRenderer";
import WorkspaceSplitView from "@/components/workspace/WorkspaceSplitView";
import SettingsModal from "@/components/workspace/SettingsModal";
import SrsReviewModal from "@/components/workspace/SrsReviewModal";
import {
    Add,
    ArrowLeft,
    ArrowRight,
    Calendar,
    Check,
    ChevronDown,
    Code,
    Document,
    Download,
    FileVideo,
    Glossary,
    Home,
    Icon,
    Information,
    Key,
    Library,
    Locked,
    Menu,
    Notes,
    Progress as ProgressGlyph,
    Settings,
    Success,
    Time,
    Tool,
    Trophy,
    Upload,
    type GlazeIcon,
} from "@/components/glaze/icon";
import { Alert, AlertAction, AlertDescription } from "@/components/glaze/ui/alert";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import { DataList, DataListItem, DataListLabel, DataListValue } from "@/components/glaze/ui/data-list";
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/glaze/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/glaze/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/glaze/ui/empty-state";
import { Input } from "@/components/glaze/ui/input";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemLink,
    ItemMedia,
    ItemMeta,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { Kbd } from "@/components/glaze/ui/kbd";
import { Progress, ProgressLabel, ProgressValue } from "@/components/glaze/ui/progress";
import {
    Sheet,
    SheetBody,
    SheetClose,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/glaze/ui/sheet";
import { toast } from "@/components/glaze/ui/toast";
import { cn } from "@/lib/glaze/utils";

import { Link, useNavigate } from "@tanstack/react-router";
import { SECTION_LABELS } from "@/lib/constants";
import { exportAsMarkdown, exportAsJSON, exportAsPDF } from "@/lib/export";
import { saveVersion, getVersions } from "@/lib/versioning";
import { getWorkspacePersistence } from "@/lib/workspace-persistence";
import { getUserConfig } from "@/lib/userConfig";
import { getStorage } from "@/lib/storage";
import { seedSrsItems } from "@/lib/srs";

/** The glyph beside each tool section in the workspace sidebar, by section type. */
const UTILITY_ICONS: Record<string, GlazeIcon> = {
    milestones: Success,
    tasks: Check,
    progress: ProgressGlyph,
    resources: Library,
    videos: FileVideo,
    calendar: Calendar,
    notes: Notes,
    glossary: Glossary,
    submissions: Upload,
    custom: Tool,
};

/** The four tour steps, in order. Each points at a part of the workspace the learner should know. */
const TOUR_STEPS = [
    { title: "These are your course modules", body: "Navigate between different sections, tools, and materials here." },
    { title: "Your completion is tracked here", body: "Watch the progress bar fill up as you complete tasks throughout the course." },
    { title: "Open any module to start learning", body: "Dive into your first generated learning module." },
    { title: "Mark modules done as you go", body: "Check this off when you finish all tasks to boost your progress." },
];

const SHORTCUTS = [
    { k: "J", d: "Next task" },
    { k: "K", d: "Previous task" },
    { k: "Space", d: "Toggle task status" },
    { k: "[", d: "Previous module" },
    { k: "]", d: "Next module" },
];

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
    const phone = useMediaQuery({ query: PHONE_QUERY, serverValue: false });
    const reduceMotion = useReducedMotion();
    const scrollArea = useRef<HTMLDivElement>(null);
    // Rail, phone panel and desktop panel widths, in px: w-16, w-64 and w-72.
    const sidebarWidth = !sidebarOpen ? 64 : phone ? 256 : 288;

    // Gamification Hooks
    const { currentStreak, isAtRisk, logActivity, tasksCompletedToday, tasksCompletedYesterday } = useStreak();
    const { unlockBadge, recentBadge, clearRecentBadge, getBadges } = useAchievements();
    const { sessionTimeMs, getModuleTime } = useTimeTracker(activeSectionId !== "dashboard" ? activeSectionId : undefined);
    const navigate = useNavigate();
    const [userConfig, setUserConfig] = useState<any>(null);
    const [srsItems, setSrsItems] = useState<SrsItem[]>([]);
    const [isSrsModalOpen, setIsSrsModalOpen] = useState(false);
    const persistence = getWorkspacePersistence();

    useEffect(() => {
        setUserConfig(getUserConfig());
        // On a phone the open sidebar floats over the page, so it starts closed there.
        if (window.matchMedia("(max-width: 639px)").matches) setSidebarOpen(false);
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

    const validSections = roadmap.sections;
    const activeSection = validSections.find((s) => s.id === activeSectionId);
    const utilitySections = validSections.filter((s) => s.type !== "module" && s.type !== "milestones" && s.type !== "progress");

    // Check for AI generation quality (fewer than 3 sections total, or minimal data)
    // Roadmap generally has progress/calendar by default plus modules. If less than let's say 4 sections total.
    const isLowQuality = roadmap.sections.length <= 3;

    const getMotivationalMessage = (percent: number) => {
        if (percent === 0) return "Just getting started";
        if (percent < 25) return "Off to a great start";
        if (percent < 50) return "Building momentum";
        if (percent < 75) return "More than halfway there";
        if (percent < 100) return "Almost complete";
        return "Course complete";
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
            await fetchPrivateApi("/api/srs/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: reviewedItems }),
            });
        } catch {
            // Signed-out users stay local-first; sync failure is non-blocking here.
        }
    }, [persistence, roadmap.id]);

    // A new achievement shows as one toast, then clears so it is not shown twice.
    useEffect(() => {
        if (!recentBadge) return;
        toast.success(`Achievement unlocked: ${recentBadge.title}`, { description: recentBadge.description });
        clearRecentBadge();
    }, [recentBadge, clearRecentBadge]);

    const hasOverdue = calendarEvents.some(e => {
        const days = (new Date(e.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return days < 0 && !e.completed;
    });
    const matches = (label: string) => !searchQuery || label.toLowerCase().includes(searchQuery.toLowerCase());
    const tourCopy = TOUR_STEPS[tourStep];

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-page text-text-1">
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                {phone && <div aria-hidden="true" className="w-16 shrink-0" />}
                <motion.aside
                    id="tour-sidebar"
                    aria-label="Workspace"
                    initial={false}
                    animate={{ width: sidebarWidth }}
                    transition={reduceMotion ? { duration: 0 } : springs.drawer}
                    className={cn(
                        "z-(--z-overlay) flex shrink-0 flex-col overflow-hidden border-e border-line-faint",
                        phone ? "fixed inset-y-0 start-0" : "relative",
                        phone && sidebarOpen ? "material-heavy" : "bg-paper",
                    )}
                >
                    {/* Header: Collapse Toggle */}
                    <div className="flex h-14 items-center gap-2 border-b border-line-faint px-3">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            aria-label="Toggle sidebar"
                            aria-expanded={sidebarOpen}
                            title="Toggle sidebar (Ctrl+\)"
                        >
                            <Icon icon={Menu} />
                        </Button>
                        {sidebarOpen && (
                            <div className="flex min-w-0 items-center gap-2">
                                {logoUrl && (
                                    <>
                                        {/* next/image is not practical here because the logo URL is fully user-defined. */}
                                        <img src={logoUrl} alt="Logo" className="size-5 object-contain" />
                                    </>
                                )}
                                <span className="truncate type-label">{workspaceTitle}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto pb-6">
                        {/* Search & Mini-progress (Only shown when open) */}
                        {sidebarOpen && (
                            <div className="flex flex-col gap-3 p-3">
                                <Input
                                    mode="search"
                                    placeholder="Search workspace"
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                    aria-label="Search workspace"
                                />
                                <Progress value={progress.overall} size="sm">
                                    <ProgressLabel>Total progress</ProgressLabel>
                                    <ProgressValue />
                                </Progress>
                            </div>
                        )}

                        <nav aria-label="Workspace sections" className="flex flex-col gap-4 p-2">
                            {/* Dashboard Link */}
                            <div className="flex flex-col">
                                <Item size="sm" selected={activeSectionId === "dashboard"}>
                                    <ItemMedia variant="icon">
                                        <Icon icon={Home} />
                                    </ItemMedia>
                                    <ItemContent className={cn(!sidebarOpen && "sr-only")}>
                                        <ItemTitle>
                                            <ItemLink
                                                href="#overview"
                                                aria-current={activeSectionId === "dashboard" ? "page" : undefined}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    onNavigate("dashboard");
                                                }}
                                            >
                                                Overview
                                            </ItemLink>
                                        </ItemTitle>
                                    </ItemContent>
                                </Item>
                            </div>

                            {/* Modules */}
                            {moduleSections.length > 0 && (
                                <div className="flex flex-col" role="group" aria-label="Modules">
                                    {moduleSections.map((section, idx) => {
                                        const isActive = section.id === activeSectionId;
                                        const modulePercent = getModuleProgress(section);
                                        // Handle search filtering
                                        if (!matches(section.title)) return null;

                                        return (
                                            <Item key={section.id} size="sm" selected={isActive}>
                                                <ItemMedia variant="icon">
                                                    {modulePercent === 100 ? (
                                                        <Icon icon={Success} label="Complete" />
                                                    ) : (
                                                        <span className="type-caption tabular-nums text-text-2">{idx + 1}</span>
                                                    )}
                                                </ItemMedia>
                                                <ItemContent className={cn(!sidebarOpen && "sr-only")}>
                                                    <ItemTitle>
                                                        <ItemLink
                                                            href={`#${section.id}`}
                                                            title={section.title}
                                                            aria-current={isActive ? "page" : undefined}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                onNavigate(section.id);
                                                            }}
                                                        >
                                                            {section.title}
                                                        </ItemLink>
                                                    </ItemTitle>
                                                </ItemContent>
                                            </Item>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Tools / Utility */}
                            {utilitySections.length > 0 && sidebarOpen && (
                                <div className="flex flex-col" role="group" aria-label="Resources and tools">
                                    {utilitySections.map((section) => {
                                        const isActive = section.id === activeSectionId;
                                        const label = section.title || SECTION_LABELS[section.type] || section.type;
                                        if (!matches(label)) return null;

                                        return (
                                            <Item key={section.id} size="sm" selected={isActive}>
                                                <ItemMedia variant="icon">
                                                    <Icon icon={UTILITY_ICONS[section.type] ?? Tool} />
                                                </ItemMedia>
                                                <ItemContent>
                                                    <ItemTitle>
                                                        <ItemLink
                                                            href={`#${section.id}`}
                                                            aria-current={isActive ? "page" : undefined}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                onNavigate(section.id);
                                                            }}
                                                        >
                                                            {label}
                                                        </ItemLink>
                                                    </ItemTitle>
                                                </ItemContent>
                                            </Item>
                                        );
                                    })}
                                </div>
                            )}
                        </nav>
                    </div>

                    {/* Sidebar Footer */}
                    <div className="mt-auto flex flex-col gap-1 border-t border-line-faint p-2">
                        {!isEmbed && (
                            <Item size="sm" render={<Link to="/" />}>
                                <ItemMedia variant="icon">
                                    <Icon icon={ArrowLeft} />
                                </ItemMedia>
                                <ItemContent className={cn(!sidebarOpen && "sr-only")}>
                                    <ItemTitle>Back to home</ItemTitle>
                                </ItemContent>
                            </Item>
                        )}
                        {!isEmbed && !isReadOnly && (
                            <>
                                <Item size="sm" render={<Link to="/settings" />}>
                                    <ItemMedia variant="icon">
                                        <Icon icon={Settings} />
                                    </ItemMedia>
                                    <ItemContent className={cn(!sidebarOpen && "sr-only")}>
                                        <ItemTitle>Settings</ItemTitle>
                                    </ItemContent>
                                </Item>
                                {sidebarOpen && userConfig?.useCustomKey && (
                                    <p className="flex items-center gap-1.5 px-3 py-1 type-caption text-text-2" title="Using your custom AI provider">
                                        <Icon icon={Key} className="text-text-3" /> Custom API
                                    </p>
                                )}
                                {sidebarOpen && userConfig?.showProgressNotice !== false && (
                                    <div className="flex items-center justify-between gap-2 px-3 py-1">
                                        <span className="type-caption text-text-2">Saved in this browser</span>
                                        <Button variant="ghost" size="sm" onClick={() => setIsResetDialogOpen(true)}>
                                            Reset
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                        {!hideWatermark && sidebarOpen && (
                            <p className="px-3 py-1 type-caption text-text-2">
                                Powered by ZNS Nexus
                            </p>
                        )}
                    </div>
                </motion.aside>

                {/* Mobile overlay */}
                <AnimatePresence>
                    {phone && sidebarOpen && (
                        <motion.div
                            key="scrim"
                            aria-hidden="true"
                            className="fixed inset-0 z-(--z-sticky) bg-scrim"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={springs.fade}
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}
                </AnimatePresence>

                {/* Main Content Area */}
                <main id="main-content" className="relative flex flex-1 flex-col overflow-y-auto bg-page">
                    {/* Workspace Header */}
                    {!isEmbed && !isReadOnly && (
                        <MaterialBar
                            scrollContainer={scrollArea}
                            className="sticky top-0 z-(--z-sticky) flex shrink-0 flex-wrap items-center justify-end gap-2 px-4 py-2 sm:px-6"
                        >
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setShowShortcuts(true)}
                                aria-label="Open keyboard shortcuts"
                            >
                                <Icon icon={Information} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setShowVersionHistory(true)}
                                aria-label="Open version history"
                            >
                                <Icon icon={Time} />
                            </Button>
                            {/* Export Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger render={<Button variant="secondary" size="sm" />}>
                                    Export
                                    <Icon icon={ChevronDown} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => exportAsMarkdown(roadmap)}>
                                        <Icon icon={Document} /> Download as Markdown
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => exportAsJSON(roadmap)}>
                                        <Icon icon={Code} /> Download as JSON
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => exportAsPDF(roadmap)}>
                                        <Icon icon={Download} /> Print or save as PDF
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setIsSrsModalOpen(true)}
                                disabled={dueSrsItems.length === 0}
                                title={dueSrsItems.length === 0 ? "No spaced repetition cards are due right now" : `Review ${dueSrsItems.length} spaced repetition cards`}
                            >
                                {dueSrsItems.length > 0 ? `Review ${dueSrsItems.length}` : "Review cards"}
                            </Button>
                        </MaterialBar>
                    )}

                    <div ref={scrollArea} className="relative flex-1 overflow-y-auto bg-page">
                        {/* Banners */}
                        {(isLowQuality || isAtRisk || hasOverdue) && (
                            <div className="mx-auto flex w-full max-w-256 flex-col gap-2 px-4 pt-4 sm:px-6 lg:px-10">
                                {isLowQuality && (
                                    <Alert>
                                        <AlertDescription>
                                            Your content generated a minimal workspace. For richer results, try adding more detail to your content or use a longer guide.
                                        </AlertDescription>
                                        <AlertAction>
                                            <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/create" })}>
                                                Improve my content
                                            </Button>
                                        </AlertAction>
                                    </Alert>
                                )}
                                {isAtRisk && (
                                    <Alert status="warn">
                                        <AlertDescription>
                                            Your {currentStreak} day learning streak is at risk. Complete a task today to keep it going.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {hasOverdue && (
                                    <Alert status="fail">
                                        <AlertDescription>You have overdue deadlines. Check your calendar.</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}

                        {activeSectionId === "dashboard" ? (
                            // COURSE DASHBOARD
                            <div className="mx-auto flex max-w-256 flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-10">
                                {/* Dashboard Header */}
                                <header className="flex flex-col gap-3">
                                    <h1 className="type-title">{roadmap.title}</h1>
                                    <p className="flex flex-wrap items-center gap-2 type-body-sm text-text-2">
                                        <Badge>{roadmap.mode} course</Badge>
                                        {currentStreak > 0 && <span>{currentStreak} day streak</span>}
                                    </p>
                                    {roadmap.summary && (
                                        <p className="max-w-measure type-body text-text-2">{roadmap.summary}</p>
                                    )}
                                </header>

                                {roadmap.objectives && roadmap.objectives.length > 0 && (
                                    <section>
                                        <h2 className="type-heading-sm">Learning objectives</h2>
                                        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                            {roadmap.objectives.map((obj, i) => (
                                                <li key={i} className="flex items-start gap-3 type-body-sm text-text-1">
                                                    <Icon icon={Check} className="mt-1 text-text-3" />
                                                    {obj}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}

                                {/* Progress & Continue */}
                                <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
                                    <div id="tour-progress" className="shell lg:col-span-2">
                                        <div className="panel flex flex-col gap-3 p-3">
                                            <div>
                                                <h2 className="type-heading">{getMotivationalMessage(progress.overall)}</h2>
                                                <p className="mt-1 type-body-sm text-text-2">
                                                    {progress.completedTasks} of {progress.totalTasks} tasks completed
                                                </p>
                                            </div>
                                            <Progress value={progress.overall} aria-label="Course progress">
                                                <ProgressValue />
                                            </Progress>
                                        </div>
                                        <div className="shell-foot">
                                            <span className="me-auto type-caption text-text-2">
                                                {totalModules} modules · {progress.totalTasks} tasks · {totalResources} resources · {totalVideos} videos
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => setIsSrsModalOpen(true)}
                                                disabled={dueSrsItems.length === 0 || isReadOnly}
                                            >
                                                {dueSrsItems.length > 0 ? `Review ${dueSrsItems.length} cards` : "No cards due"}
                                            </Button>
                                            {firstIncompleteModule && (
                                                <Button size="sm" onClick={() => onNavigate(firstIncompleteModule.id)}>
                                                    Continue learning
                                                    <Icon icon={ArrowRight} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Smart Insights */}
                                    <div className="flex flex-col gap-4">
                                        <section className="shell">
                                            <div className="panel p-3">
                                                <h2 className="type-heading-sm">Your progress</h2>
                                                <DataList className="mt-3">
                                                    <DataListItem>
                                                        <DataListLabel>Tasks today</DataListLabel>
                                                        <DataListValue>{tasksCompletedToday}</DataListValue>
                                                    </DataListItem>
                                                    <DataListItem>
                                                        <DataListLabel>Tasks yesterday</DataListLabel>
                                                        <DataListValue>{tasksCompletedYesterday}</DataListValue>
                                                    </DataListItem>
                                                    <DataListItem>
                                                        <DataListLabel>Time left</DataListLabel>
                                                        <DataListValue>
                                                            {progress.completedTasks > 0 && progress.totalTasks > progress.completedTasks
                                                                ? formatTime((sessionTimeMs / progress.completedTasks) * (progress.totalTasks - progress.completedTasks))
                                                                : "-"}
                                                        </DataListValue>
                                                    </DataListItem>
                                                    {mostTimeSpentModule.module && (
                                                        <DataListItem>
                                                            <DataListLabel>Most time on</DataListLabel>
                                                            <DataListValue>
                                                                {mostTimeSpentModule.module.title} ({formatTime(mostTimeSpentModule.time)})
                                                            </DataListValue>
                                                        </DataListItem>
                                                    )}
                                                </DataList>
                                            </div>
                                        </section>

                                        {calendarEvents.length > 0 && (
                                            <section className="shell">
                                                <div className="panel p-3">
                                                    <h2 className="type-heading-sm">Upcoming deadlines</h2>
                                                    <ul className="mt-3 flex flex-col gap-3">
                                                        {calendarEvents.slice(0, 3).map(event => {
                                                            const days = (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                                                            return (
                                                                <li key={event.id} className="flex items-start justify-between gap-3">
                                                                    <span className="min-w-0">
                                                                        <span className="block truncate type-label">{event.title}</span>
                                                                        <span className="type-caption text-text-2">{new Date(event.date).toLocaleDateString()}</span>
                                                                    </span>
                                                                    <Badge variant={days < 0 ? "neutral" : days < 3 ? "warn" : "neutral"}>
                                                                        {days < 0 ? "Past" : `${Math.ceil(days)}d`}
                                                                    </Badge>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            </section>
                                        )}
                                    </div>
                                </div>

                                {/* Module list */}
                                {moduleSections.length > 0 && (
                                    <section>
                                        <h2 className="type-heading-sm">Course modules</h2>
                                        <ItemGroup className="mt-2" aria-label="Course modules">
                                            {moduleSections.map((mod, idx) => {
                                                const modPercent = getModuleProgress(mod);
                                                const tasksCount = mod.type === "module" ? ((mod as ModuleSectionType).data.tasks || []).length : 0;
                                                const status = modPercent === 100 ? "Complete" : modPercent > 0 ? "In progress" : "Not started";
                                                const description = mod.type === "module" ? (mod as ModuleSectionType).data.description : undefined;

                                                return (
                                                    <Item key={mod.id} id={idx === 0 ? "tour-first-module" : undefined}>
                                                        <ItemContent>
                                                            <ItemTitle>
                                                                <ItemLink
                                                                    href={`#${mod.id}`}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        onNavigate(mod.id);
                                                                    }}
                                                                >
                                                                    {mod.title}
                                                                </ItemLink>
                                                            </ItemTitle>
                                                            {description && <ItemDescription>{description}</ItemDescription>}
                                                        </ItemContent>
                                                        <ItemMeta>{tasksCount} tasks · {modPercent}%</ItemMeta>
                                                        <Badge variant={modPercent === 100 ? "ok" : "neutral"}>{status}</Badge>
                                                    </Item>
                                                );
                                            })}
                                        </ItemGroup>
                                    </section>
                                )}

                                {/* Achievements Section */}
                                <section>
                                    <h2 className="type-heading-sm">Achievements</h2>
                                    <ItemGroup className="mt-2" aria-label="Achievements">
                                        {getBadges().map(badge => (
                                            <Item key={badge.id} disabled={!badge.unlockedAt}>
                                                <ItemMedia variant="icon">
                                                    <Icon icon={badge.unlockedAt ? Trophy : Locked} />
                                                </ItemMedia>
                                                <ItemContent>
                                                    <ItemTitle>{badge.title}</ItemTitle>
                                                    <ItemDescription>{badge.description}</ItemDescription>
                                                </ItemContent>
                                                {badge.unlockedAt && <Badge variant="ok">Unlocked</Badge>}
                                            </Item>
                                        ))}
                                    </ItemGroup>
                                </section>
                            </div>
                        ) : activeSection?.type === "module" || activeSection?.type === "milestones" ? (
                            <div className="relative min-h-full w-full flex-1">
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
                            <div className="relative mx-auto min-h-full w-full max-w-256 px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-10">
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

            {/* Quick actions */}
            {!isReadOnly && (
                <div className="fixed bottom-6 end-6 z-(--z-sticky)">
                    <DropdownMenu>
                        <DropdownMenuTrigger render={<Button size="icon-lg" aria-label="Quick actions" />}>
                            <Icon icon={Add} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="top">
                            <DropdownMenuItem>Add note</DropdownMenuItem>
                            <DropdownMenuItem>Add resource</DropdownMenuItem>
                            <DropdownMenuItem>Add video</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Regenerate workspace</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            <SrsReviewModal
                isOpen={isSrsModalOpen}
                items={dueSrsItems}
                onClose={() => setIsSrsModalOpen(false)}
                onSave={handleSaveSrsItems}
            />

            {/* Tour */}
            <Dialog open={tourStep >= 0 && !!tourCopy} onOpenChange={(open) => { if (!open) endTour(); }}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>{tourCopy?.title}</DialogTitle>
                        <DialogDescription>{tourCopy?.body}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose>End tour</DialogClose>
                        <Button onClick={handleNextTourStep}>{tourStep === TOUR_STEPS.length - 1 ? "Finish" : "Next"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Keyboard shortcuts */}
            <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>Keyboard shortcuts</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <DataList>
                            {SHORTCUTS.map(s => (
                                <DataListItem key={s.k}>
                                    <DataListLabel>{s.d}</DataListLabel>
                                    <DataListValue><Kbd>{s.k}</Kbd></DataListValue>
                                </DataListItem>
                            ))}
                        </DataList>
                    </DialogBody>
                    <DialogFooter>
                        <DialogClose>Close</DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Version History */}
            <Sheet open={showVersionHistory} onOpenChange={setShowVersionHistory}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Version history</SheetTitle>
                    </SheetHeader>
                    <SheetBody>
                        {versions.length === 0 ? (
                            <Empty reason="empty">
                                <EmptyHeader>
                                    <EmptyTitle>No saved versions yet</EmptyTitle>
                                </EmptyHeader>
                            </Empty>
                        ) : (
                            <ItemGroup aria-label="Saved versions">
                                {versions.map((v, i) => (
                                    <Item key={i}>
                                        <ItemContent>
                                            <ItemTitle>{v.label}</ItemTitle>
                                            <ItemDescription>
                                                {v.sections?.length || 0} modules · {new Date(v.createdAt).toLocaleDateString()}
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <Button variant="secondary" size="sm" onClick={() => setVersionToRestore(v)}>
                                                Restore
                                            </Button>
                                        </ItemActions>
                                    </Item>
                                ))}
                            </ItemGroup>
                        )}
                    </SheetBody>
                    <SheetFooter>
                        <SheetClose>Close</SheetClose>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog
                open={Boolean(versionToRestore)}
                onOpenChange={(open) => {
                    if (!open) {
                        setVersionToRestore(null);
                    }
                }}
            >
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>Restore saved version?</DialogTitle>
                        <DialogDescription>
                            Your current progress will be saved as a new version before this snapshot is restored.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose>Cancel</DialogClose>
                        <Button onClick={handleRestoreVersion}>Restore version</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <DialogContent size="sm">
                    <DialogHeader>
                        <DialogTitle>Reset all workspace progress?</DialogTitle>
                        <DialogDescription>
                            This clears completion state for every module task and subtask in this workspace. The action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose>Cancel</DialogClose>
                        <Button variant="destructive" onClick={handleResetProgress}>Reset progress</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modals */}
            <SettingsModal
                roadmap={roadmap}
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                onUpdateBranding={(branding) => onUpdateRoadmap?.({ branding })}
            />

        </div>
    );
}

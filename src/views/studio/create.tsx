import { Suspense, useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, FileUp, KeyRound, Loader2, Wand2, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getStorage } from "@/lib/storage";
import { getActiveApiKey, getActiveModel, getUserConfig } from "@/lib/userConfig";
import type { Roadmap } from "@/types";
import { cn } from "@/lib/utils";

const LOADING_MESSAGES = [
"Reading your material...",
"Extracting key concepts...",
"Structuring modules...",
"Finalizing steps..."
];

export default function CreatePage() {
    return (
        <Suspense fallback={<div className="page-shell-wide flex min-h-[60vh] items-center justify-center" />}>
            <CreatePageContent />
        </Suspense>
    );
}

function CreatePageContent() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [creationStep, setCreationStep] = useState<"input" | "generating" | "review">("input");
    
    // Form state
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [mode, setMode] = useState<"general" | "intern">("general");
    
    // UI state
    const [isDragging, setIsDragging] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [error, setError] = useState("");
    const [upgradeMessage, setUpgradeMessage] = useState("");
    
    // Draft State
    const [draftRoadmap, setDraftRoadmap] = useState<Roadmap | null>(null);

    const hasContent = content.trim().length > 0;

    const processFile = useCallback(
        (file: File) => {
            if (!file.name.match(/\.(md|txt|markdown)$/i)) {
                setError("Only .md, .txt, and .markdown files are supported.");
                return;
            }
            setError("");
            const reader = new FileReader();
            reader.onload = (event) => {
                const nextContent = (event.target?.result as string) || "";
                setContent(nextContent);
                if (!title.trim()) setTitle(file.name.replace(/\.\w+$/, ""));
            };
            reader.readAsText(file);
        },
        [title],
    );

    const handleGenerate = async () => {
        if (!hasContent) {
            setError("Paste or upload content before generating.");
            return;
        }

        setError("");
        setCreationStep("generating");
        setLoadingStep(0);
        
        // Simulating the stages visually
        const interval = setInterval(() => {
            setLoadingStep(prev => Math.min(prev + 1, 3));
        }, 1200);

        try {
            const userConfig = getUserConfig();
            const activeApiKey = getActiveApiKey(userConfig);
            const useCustomKey = Boolean(userConfig.useCustomKey && activeApiKey);

            const response = await fetch("/api/parse-roadmap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: content.trim(),
                    mode,
                    title: title.trim() || undefined,
                    userApiKey: useCustomKey ? activeApiKey : undefined,
                    userModel: useCustomKey ? getActiveModel(userConfig) : undefined,
                    userProvider: useCustomKey ? userConfig.provider : undefined,
                }),
            });

            clearInterval(interval);

            if (!response.ok) {
                const payload = await response.json().catch(() => ({ error: "Failed to generate workspace" }));
                if (payload.error === "limit_reached") {
                    setUpgradeMessage(payload.message ?? "Plan limit reached.");
                    setCreationStep("input");
                    return;
                }
                throw new Error(payload.message ?? payload.error ?? "Something went wrong");
            }

            const payload = await response.json();
            if (!payload.success || !payload.roadmap) {
                throw new Error(payload.error ?? "Incomplete response.");
            }

            let loadedTitle = payload.roadmap.title;
            if (!loadedTitle || loadedTitle === "Untitled Course") {
               loadedTitle = title.trim() || "Untitled Workspace"; 
            }

            const roadmap: Roadmap = {
                ...payload.roadmap,
                title: loadedTitle,
                id: crypto.randomUUID(),
                rawContent: content.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            setDraftRoadmap(roadmap);
            setCreationStep("review");
            
        } catch (nextError) {
            clearInterval(interval);
            setError(nextError instanceof Error ? nextError.message : "An unexpected error occurred");
            setCreationStep("input");
        }
    };

    const handleCreateFinal = () => {
        if (!draftRoadmap) return;
        getStorage().saveRoadmap(draftRoadmap);
        navigate({ to: "/workspace/$id", params: { id: draftRoadmap.id } });
    };

    return (
        <>
            <div className="studio-page">
                {creationStep !== "review" && (
                    <section className="app-header-block">
                        <h1>Create</h1>
                        <p className="max-w-2xl text-sm text-text-muted">
                            Paste a guide, notes or markdown. The steps and modules become a workspace.
                        </p>
                    </section>
                )}

                {creationStep === "input" && (
                    <div className="flex flex-col gap-[14px]">
                        <div className="flex flex-wrap items-end gap-[14px]">
                            <div className="min-w-[240px] flex-1">
                                <label htmlFor="create-title" className="field-label">Workspace title</label>
                                <Input
                                    id="create-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Optional. Taken from the content if empty."
                                />
                            </div>
                            <div>
                                <p className="field-label">Parsing</p>
                                <Segmented
                                    label="Parsing mode"
                                    value={mode}
                                    onChange={setMode}
                                    className="h-10"
                                    options={[
                                        { key: "general", label: "Standard" },
                                        { key: "intern", label: "Structured" },
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <Textarea
                                aria-label="Guide or notes"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
                                }}
                                placeholder="Paste a guide, course outline or notes"
                                className={cn(
                                    "min-h-[420px] resize-y rounded-2xl border-dashed p-5 text-[15px] leading-relaxed",
                                    isDragging ? "border-text-soft bg-surface-subtle" : "border-border-strong",
                                )}
                            />

                            {!content && (
                                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-text-soft">
                                    <FileUp size={28} strokeWidth={1.5} />
                                    <p className="text-[13px]">or drop a .md or .txt file</p>
                                </div>
                            )}
                        </div>

                        {error && (
                            <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                                {error}
                            </p>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                                    <FileUp size={15} /> Upload file
                                </Button>
                                {hasContent ? (
                                    <span className="text-[13px] tabular-nums text-text-soft">
                                        {content.trim().split(/s+/).length.toLocaleString()} words
                                    </span>
                                ) : null}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".md,.markdown,.txt"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                            />

                            <Button type="button" onClick={handleGenerate} disabled={!hasContent}>
                                <Wand2 size={15} /> Generate roadmap
                            </Button>
                        </div>
                    </div>
                )}

                {creationStep === "generating" && (
                    <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-500">
                        <div className="relative">
                            <Loader2 size={32} className="animate-spin text-text-soft" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-lg text-text">{LOADING_MESSAGES[loadingStep]}</h2>
                            <p className="mt-2 text-text-muted text-sm">Please wait while the AI breaks down your content.</p>
                        </div>
                        
                        <div className="max-w-md w-full pt-8 space-y-4">
                            <div className="h-4 bg-[var(--color-surface)] rounded-md w-3/4" />
                            <div className="h-4 bg-[var(--color-surface)] rounded-md" />
                            <div className="h-4 bg-[var(--color-surface)] rounded-md w-5/6" />
                        </div>
                    </div>
                )}

                {creationStep === "review" && draftRoadmap && (
                    <div className="h-[calc(100vh-8rem)] flex flex-col pt-2 animate-in slide-in-from-bottom-4 duration-500">
                        <header className="flex items-center justify-between border-b border-border pb-4 mb-6">
                            <div>
                                <h1 className="text-2xl font-display text-text truncate">{draftRoadmap.title}</h1>
                                <p className="text-sm text-text-muted">Review the generated structure before creating your workspace.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" onClick={() => setCreationStep("input")}>
                                    <ArrowLeft size={16} className="mr-2" /> Back
                                </Button>
                                <Button onClick={handleCreateFinal}>
                                    Create Workspace <ArrowRight size={16} className="ml-2" />
                                </Button>
                            </div>
                        </header>
                        
                        <div className="flex-1 min-h-0 grid lg:grid-cols-2 gap-8">
                            <div className="flex flex-col h-full bg-[var(--color-surface)] border border-border rounded-xl overflow-hidden">
                                <div className="px-5 py-3 border-b border-border bg-[var(--color-page)] flex justify-between items-center">
                                    <span className="text-xs font-semibold text-text-muted">Source Text</span>
                                </div>
                                <div className="p-5 overflow-y-auto flex-1 mono-surface text-sm leading-relaxed text-text-muted whitespace-pre-wrap">
                                    {content}
                                </div>
                            </div>
                            
                            <div className="flex flex-col h-full bg-[var(--color-page)] border border-border rounded-xl overflow-hidden">
                                <div className="px-5 py-3 border-b border-border bg-[var(--color-page)] flex justify-between items-center">
                                    <span className="text-xs font-semibold text-text">Generated Modules</span>
                                    <span className="text-xs text-text-muted">You can edit these later</span>
                                </div>
                                <div className="p-5 overflow-y-auto flex-1 space-y-6">
                                    {draftRoadmap.sections.filter(s => s.type === "module").map((s, i) => {
                                        const mod = s as import("@/types").ModuleSection;
                                        return (
                                        <div key={i} className="group border-l-2 border-border pl-4 ml-2 hover:border-text-primary transition-colors">
                                            <h3 className="font-display text-lg text-text mb-2">Module {i+1}: {mod.title || "Untitled"}</h3>
                                            <div className="space-y-2">
                                                {mod.data?.tasks && Array.isArray(mod.data.tasks) && mod.data.tasks.map((task, j) => (
                                                    <div key={j} className="text-sm text-text-muted flex items-start gap-2 bg-[var(--color-surface)] p-2 rounded border border-border/50 group-hover:border-border transition-colors">
                                                        <span className="text-text-muted mt-[2px] text-xs">■</span>
                                                        <span className="truncate">{task.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {upgradeMessage && (
                <div className="fixed inset-x-0 bottom-0 z-[80] flex justify-center p-4 sm:p-6">
                    <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl">
                        <p className="text-sm leading-6 text-text">{upgradeMessage}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <Link to="/settings" search={{ tab: "ai" }} className="button-primary">
                                <KeyRound size={14} />
                                Add your own key
                            </Link>
                            <button type="button" onClick={() => setUpgradeMessage("")} className="button-secondary">
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

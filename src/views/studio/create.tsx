import { Suspense, useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, FileUp, KeyRound, Loader2, Wand2, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            <div className="page-shell-wide py-8">
                {creationStep !== "review" && (
                    <section className="app-header-block mb-8">
                        <p className="eyebrow">Content Import</p>
                        <h1 className="text-3xl font-display leading-tight text-text-primary md:text-5xl">
                            Turn scattered notes into a roadmap.
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">
                            Drop in your guides, PDFs (as text for now), or markdown. We&apos;ll extract the steps and modules.
                        </p>
                    </section>
                )}

                {creationStep === "input" && (
                    <div className="max-w-4xl max-w-full">
                        <div className="mb-6 grid gap-6 md:grid-cols-2">
                             <div>
                                <label className="mb-2 block text-sm font-medium text-text-primary">Workspace Title</label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Master Next.js 15"
                                    className="bg-[var(--color-surface)]"
                                />
                             </div>
                             <div>
                                <p className="mb-2 block text-sm font-medium text-text-primary">Parsing Mode</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button type="button" variant={mode === "general" ? "default" : "outline"} onClick={() => setMode("general")}>Standard</Button>
                                    <Button type="button" variant={mode === "intern" ? "default" : "outline"} onClick={() => setMode("intern")}>Structured</Button>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <Textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
                                }}
                                placeholder="Paste your raw notes, guides, or course curriculum here..."
                                className={cn(
                                    "mono-surface min-h-[400px] w-full resize-y bg-white/5 p-6 text-[15px] leading-relaxed shadow-sm transition-all duration-300 border-2 border-dashed rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50",
                                    isDragging ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]" : "border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                                )}
                            />
                            
                            {!content && (
                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-zinc-500 opacity-80 group/dropzone transition-all">
                                    <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4 animate-bounce hover:bg-white/10 transition-colors shadow-lg">
                                        <FileUp size={40} className="stroke-[1.5] text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                    </div>
                                    <p className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-400">Drag & Drop Note/MD</p>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="mt-4 rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/5 p-4 text-sm text-[var(--color-danger)]">
                                {error}
                            </div>
                        )}

                        <div className="mt-8 flex items-center justify-between">
                            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                                <FileUp size={16} className="mr-2" /> Upload File
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".md,.markdown,.txt"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                            />
                            
                            <Button 
                                type="button" 
                                onClick={handleGenerate} 
                                disabled={!hasContent}
                                className="ps-6 pe-5 h-12"
                            >
                                Generate Roadmap <Wand2 size={16} className="ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {creationStep === "generating" && (
                    <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="absolute inset-0 animate-ping opacity-20 rounded-full bg-emerald-500 blur-xl" />
                            <Loader2 size={48} className="animate-spin text-emerald-400 relative z-10 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-display text-zinc-100 tracking-tight">{LOADING_MESSAGES[loadingStep]}</h2>
                            <p className="mt-2 text-zinc-400 text-sm">Please wait while the AI breaks down your content.</p>
                        </div>
                        
                        <div className="max-w-md w-full pt-8 space-y-4">
                            <div className="h-4 bg-[var(--color-surface)] rounded-md animate-pulse w-3/4" />
                            <div className="h-4 bg-[var(--color-surface)] rounded-md animate-pulse" />
                            <div className="h-4 bg-[var(--color-surface)] rounded-md animate-pulse w-5/6" />
                        </div>
                    </div>
                )}

                {creationStep === "review" && draftRoadmap && (
                    <div className="h-[calc(100vh-8rem)] flex flex-col pt-2 animate-in slide-in-from-bottom-4 duration-500">
                        <header className="flex items-center justify-between border-b border-border pb-4 mb-6">
                            <div>
                                <h1 className="text-2xl font-display text-text-primary truncate">{draftRoadmap.title}</h1>
                                <p className="text-sm text-text-secondary">Review the generated structure before creating your workspace.</p>
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
                            <div className="flex flex-col h-full bg-[var(--color-surface)] border border-border rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-border bg-[var(--color-page)] flex justify-between items-center">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Source Text</span>
                                </div>
                                <div className="p-5 overflow-y-auto flex-1 mono-surface text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
                                    {content}
                                </div>
                            </div>
                            
                            <div className="flex flex-col h-full bg-[var(--color-page)] border border-border rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-border bg-[var(--color-page)] flex justify-between items-center">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">Generated Modules</span>
                                    <span className="text-xs text-text-muted">You can edit these later</span>
                                </div>
                                <div className="p-5 overflow-y-auto flex-1 space-y-6">
                                    {draftRoadmap.sections.filter(s => s.type === "module").map((s, i) => {
                                        const mod = s as import("@/types").ModuleSection;
                                        return (
                                        <div key={i} className="group border-l-2 border-border pl-4 ml-2 hover:border-text-primary transition-colors">
                                            <h3 className="font-display text-lg text-text-primary mb-2">Module {i+1}: {mod.title || "Untitled"}</h3>
                                            <div className="space-y-2">
                                                {mod.data?.tasks && Array.isArray(mod.data.tasks) && mod.data.tasks.map((task, j) => (
                                                    <div key={j} className="text-sm text-text-secondary flex items-start gap-2 bg-[var(--color-surface)] p-2 rounded border border-border/50 group-hover:border-border transition-colors">
                                                        <span className="text-text-muted mt-[2px] text-[10px]">■</span>
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
                        <p className="text-sm leading-6 text-text-primary">{upgradeMessage}</p>
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

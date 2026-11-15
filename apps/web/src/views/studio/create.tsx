import { fetchPrivateApi } from "@/lib/private-api-fetch";
import { Suspense, useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
    ArrowLeft,
    ArrowRight,
    Icon,
    Pending,
    Sparkle,
    Upload,
} from "@/components/glaze/icon";
import { Alert } from "@/components/glaze/ui/alert";
import {
    AttachmentDrop,
    AttachmentDropTrigger,
} from "@/components/glaze/ui/attachment";
import { Button } from "@/components/glaze/ui/button";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import {
    SegmentedControl,
    SegmentedControlItem,
} from "@/components/glaze/ui/segmented-control";
import { SkeletonText } from "@/components/glaze/ui/skeleton";
import { Textarea } from "@/components/glaze/ui/textarea";
import PageFrame from "@/components/layout/PageFrame";
import { getStorage } from "@/lib/storage";
import {
    getActiveApiKey,
    getActiveModel,
    getUserConfig,
} from "@/lib/userConfig";
import type { Roadmap } from "@/types";

const LOADING_MESSAGES = [
    "Reading your material...",
    "Extracting key concepts...",
    "Structuring modules...",
    "Finalizing steps...",
];

export default function CreatePage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[60vh] items-center justify-center">
                    <SkeletonText lines={3} />
                </div>
            }
        >
            <CreatePageContent />
        </Suspense>
    );
}

function CreatePageContent() {
    const navigate = useNavigate();

    const [creationStep, setCreationStep] = useState<
        "input" | "generating" | "review"
    >("input");

    // Form state
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [mode, setMode] = useState<"general" | "intern">("general");

    // UI state
    const [loadingStep, setLoadingStep] = useState(0);
    const [error, setError] = useState("");

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
            setLoadingStep((prev) => Math.min(prev + 1, 3));
        }, 1200);

        try {
            const userConfig = getUserConfig();
            const activeApiKey = getActiveApiKey(userConfig);
            const useCustomKey = Boolean(
                userConfig.useCustomKey && activeApiKey,
            );

            const response = await fetchPrivateApi("/api/parse-roadmap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: content.trim(),
                    mode,
                    title: title.trim() || undefined,
                    userApiKey: useCustomKey ? activeApiKey : undefined,
                    userModel: useCustomKey
                        ? getActiveModel(userConfig)
                        : undefined,
                    userProvider: useCustomKey
                        ? userConfig.provider
                        : undefined,
                }),
            });

            clearInterval(interval);

            if (!response.ok) {
                const payload = await response
                    .json()
                    .catch(() => ({ error: "Failed to generate workspace" }));
                throw new Error(
                    payload.message ?? payload.error ?? "Something went wrong",
                );
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
            setError(
                nextError instanceof Error
                    ? nextError.message
                    : "An unexpected error occurred",
            );
            setCreationStep("input");
        }
    };

    const handleCreateFinal = () => {
        if (!draftRoadmap) return;
        getStorage().saveRoadmap(draftRoadmap);
        navigate({ to: "/workspace/$id", params: { id: draftRoadmap.id } });
    };

    return (
        <PageFrame
            title={
                creationStep === "review" && draftRoadmap
                    ? draftRoadmap.title
                    : "Create"
            }
            subtitle={
                creationStep === "review"
                    ? "Review the generated structure before creating your workspace."
                    : "Paste a guide, notes or markdown. The steps and modules become a workspace."
            }
            actions={
                creationStep === "review" ? (
                    <>
                        <Button
                            variant="ghost"
                            onClick={() => setCreationStep("input")}
                        >
                            <Icon icon={ArrowLeft} /> Back
                        </Button>
                        <Button onClick={handleCreateFinal}>
                            Create Workspace <Icon icon={ArrowRight} />
                        </Button>
                    </>
                ) : undefined
            }
        >
            {creationStep === "input" && (
                <div className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-end gap-4">
                        <Field className="min-w-0 basis-64 flex-1">
                            <FieldLabel>Workspace title</FieldLabel>
                            <Input
                                value={title}
                                onValueChange={setTitle}
                                placeholder="Optional. Taken from the content if empty."
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Parsing</FieldLabel>
                            <SegmentedControl
                                aria-label="Parsing mode"
                                value={mode}
                                onValueChange={(value) =>
                                    setMode(value as "general" | "intern")
                                }
                            >
                                <SegmentedControlItem value="general">
                                    Standard
                                </SegmentedControlItem>
                                <SegmentedControlItem value="intern">
                                    Structured
                                </SegmentedControlItem>
                            </SegmentedControl>
                        </Field>
                    </div>

                    <AttachmentDrop
                        accept=".md,.markdown,.txt"
                        multiple={false}
                        onFiles={(files) => {
                            if (files[0]) processFile(files[0]);
                        }}
                        onReject={() =>
                            setError(
                                "Only .md, .txt, and .markdown files are supported.",
                            )
                        }
                    >
                        <Field>
                            <FieldLabel>Guide or notes</FieldLabel>
                            <Textarea
                                value={content}
                                onValueChange={setContent}
                                placeholder="Paste a guide, course outline or notes, or drop a .md or .txt file"
                                autoGrow
                                minRows={12}
                                maxRows={40}
                            />
                        </Field>

                        {error ? (
                            <Alert status="fail" className="mt-4">
                                {error}
                            </Alert>
                        ) : null}

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <AttachmentDropTrigger variant="secondary">
                                    <Icon icon={Upload} /> Upload file
                                </AttachmentDropTrigger>
                                {hasContent ? (
                                    <span className="type-caption text-text-2">
                                        {content
                                            .trim()
                                            .split(/\s+/)
                                            .length.toLocaleString()}{" "}
                                        words
                                    </span>
                                ) : null}
                            </div>

                            <Button
                                onClick={handleGenerate}
                                disabled={!hasContent}
                            >
                                <Icon icon={Sparkle} /> Generate roadmap
                            </Button>
                        </div>
                    </AttachmentDrop>
                </div>
            )}

            {creationStep === "generating" && (
                <section className="shell" aria-label="Generating roadmap">
                    <div
                        className="panel flex flex-col items-center gap-4 p-10 text-center"
                        role="status"
                    >
                        <Icon
                            icon={Pending}
                            className="animate-spin text-text-2"
                        />
                        <div>
                            <h2 className="type-heading-sm">
                                {LOADING_MESSAGES[loadingStep]}
                            </h2>
                            <p className="mt-2 type-body-sm text-text-2">
                                Please wait while the AI breaks down your
                                content.
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {creationStep === "review" && draftRoadmap && (
                <div className="grid gap-4 lg:grid-cols-2">
                    <section className="shell">
                        <div className="panel">
                            <header className="border-b border-line-faint p-4 pb-3">
                                <h2 className="type-label text-text-2">
                                    Source text
                                </h2>
                            </header>
                            <div className="max-h-[70vh] overflow-y-auto p-4 whitespace-pre-wrap type-body-sm text-text-2">
                                {content}
                            </div>
                        </div>
                    </section>

                    <section className="shell">
                        <div className="panel">
                            <header className="flex items-center justify-between gap-3 border-b border-line-faint p-4 pb-3">
                                <h2 className="type-label text-text-1">
                                    Generated modules
                                </h2>
                                <p className="type-caption text-text-2">
                                    You can edit these later
                                </p>
                            </header>
                            <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto p-4">
                                {draftRoadmap.sections
                                    .filter((s) => s.type === "module")
                                    .map((s, i) => {
                                        const mod =
                                            s as import("@/types").ModuleSection;
                                        return (
                                            <div key={i}>
                                                <h3 className="type-heading-sm">
                                                    Module {i + 1}:{" "}
                                                    {mod.title || "Untitled"}
                                                </h3>
                                                <div className="mt-2 flex flex-col gap-2">
                                                    {mod.data?.tasks &&
                                                        Array.isArray(
                                                            mod.data.tasks,
                                                        ) &&
                                                        mod.data.tasks.map(
                                                            (task, j) => (
                                                                <p
                                                                    key={j}
                                                                    className="break-words rounded-panel bg-field p-2 type-body-sm text-text-2"
                                                                >
                                                                    {task.title}
                                                                </p>
                                                            ),
                                                        )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </PageFrame>
    );
}

"use client";

import { useState, useTransition } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, CopyPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { usePathname, useSearchParams } from "@/lib/router-nav";
import type { PublicRoadmapCard } from "@/types";
import { cn } from "@/lib/utils";

const difficultyTone: Record<string, string> = {
    beginner: "text-[var(--color-text-soft)]",
    intermediate: "text-[var(--color-text-soft)]",
    advanced: "text-[var(--color-accent)]",
};

export default function GalleryCard({ item }: { item: PublicRoadmapCard }) {
    const navigate = useNavigate();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    const handleFork = () => {
        setMessage(null);
        startTransition(async () => {
            try {
                const response = await fetch("/api/gallery/fork", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workspaceId: item.id }),
                });

                const payload = await response.json().catch(() => ({ success: false }));
                if (!response.ok || !payload.success || !payload.roadmap?.id) {
                    const nextPath = `${pathname}${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`;
                    window.location.assign(`/auth?next=${encodeURIComponent(nextPath)}`);
                    return;
                }

                navigate({ to: "/workspace/$id", params: { id: payload.roadmap.id } });
            } catch {
                setMessage("Sign in to continue.");
            }
        });
    };

    return (
        <Card className="group flex h-full flex-col transition-[border-color,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]">
            <CardHeader className="pb-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-sm border border-border px-2 py-1 text-xs text-text-muted">
                            {item.contentType || "Template"}
                        </span>
                        {item.difficulty ? (
                            <span className={cn("text-xs font-medium", difficultyTone[item.difficulty] ?? "text-text-muted")}>
                                {item.difficulty}
                            </span>
                        ) : null}
                    </div>
                    <CardTitle className="mt-4 line-clamp-2 text-lg tracking-[-0.02em]">{item.title}</CardTitle>
                </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col pt-0">
                <p className="line-clamp-2 text-sm leading-6 text-text-muted">
                    {item.summary || "A structured workspace starter you can adapt and continue in your own library."}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted">
                    <span>{item.moduleCount ?? 0} modules</span>
                    <span>{item.mode === "intern" ? "Structured" : "Flexible"}</span>
                    {item.forkCount > 0 ? <span>{item.forkCount} forks</span> : null}
                </div>
            </CardContent>

            <CardFooter className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs text-text-muted">
                <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
                <Button type="button" variant="secondary" onClick={handleFork} disabled={isPending} className="min-h-10">
                    <CopyPlus size={14} />
                    {isPending ? "Opening" : item.isSeed ? "Use template" : "Fork"}
                    <ArrowRight size={14} className="opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                </Button>
            </CardFooter>

            {message ? <p className="px-6 pb-6 text-sm text-text-muted">{message}</p> : null}
        </Card>
    );
}

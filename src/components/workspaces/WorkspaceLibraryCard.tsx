"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PencilLine, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Roadmap } from "@/types";
import { cn } from "@/lib/utils";
import {
    getRelativeTimeLabel,
    getRoadmapDisplayTitle,
    getRoadmapStateLabel,
    getRoadmapStats,
} from "@/lib/workspace-stats";

interface WorkspaceLibraryCardProps {
    roadmap: Roadmap;
    onDelete?: (id: string) => void;
    onRename?: (id: string, nextTitle: string) => void;
}

export default function WorkspaceLibraryCard({
    roadmap,
    onDelete,
    onRename,
}: WorkspaceLibraryCardProps) {
    const stats = getRoadmapStats(roadmap);
    const displayTitle = getRoadmapDisplayTitle(roadmap);
    const [isRenaming, setIsRenaming] = useState(false);
    const [nextTitle, setNextTitle] = useState(displayTitle);

    const handleRename = () => {
        if (!onRename) return;
        const trimmedTitle = nextTitle.trim();
        if (!trimmedTitle || trimmedTitle === displayTitle) {
            setNextTitle(displayTitle);
            setIsRenaming(false);
            return;
        }

        onRename(roadmap.id, trimmedTitle);
        setIsRenaming(false);
    };

    const handleDelete = () => {
        if (!onDelete) return;
        onDelete(roadmap.id);
    };

    const updated = getRelativeTimeLabel(
        roadmap.updatedAt || roadmap.createdAt,
    );

    if (isRenaming) {
        return (
            <article className="border-t border-border px-5 py-4 first:border-t-0">
                <label htmlFor={`rename-${roadmap.id}`} className="field-label">
                    Rename workspace
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        id={`rename-${roadmap.id}`}
                        value={nextTitle}
                        autoFocus
                        onChange={(event) => setNextTitle(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") handleRename();
                        }}
                    />
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            className="h-10"
                            onClick={handleRename}
                        >
                            Save
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-10"
                            onClick={() => {
                                setNextTitle(displayTitle);
                                setIsRenaming(false);
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </article>
        );
    }

    /** The progress moves below the title when the shared canvas narrows. */
    return (
        <article className="sy-workspace-row">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        to="/learn"
                        search={{ roadmap: roadmap.id }}
                        className="min-w-0 break-words text-[15px] font-medium text-text after:absolute after:inset-0 hover:underline hover:underline-offset-4"
                    >
                        {displayTitle}
                    </Link>
                    {roadmap.packVersion ? (
                        <span className="studio-badge">Built by Scout</span>
                    ) : null}
                </div>
                <p className="mt-1 text-[13px] text-text-soft">
                    {stats.moduleCount} module
                    {stats.moduleCount === 1 ? "" : "s"} ·{" "}
                    {getRoadmapStateLabel(stats.progressState)} · {updated}
                </p>
            </div>

            <div className="sy-workspace-progress">
                <div className="flex items-baseline justify-between text-[13px] tabular-nums">
                    <span className="text-text">{stats.percent}%</span>
                    <span className="text-text-soft">
                        {stats.completedTasks} of {stats.totalTasks}
                    </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                        className={cn(
                            "h-full rounded-full",
                            stats.progressState === "completed"
                                ? "bg-success"
                                : "bg-accent",
                        )}
                        style={{ width: `${stats.percent}%` }}
                    />
                </div>
            </div>

            <div className="relative z-10 flex items-center gap-1">
                {onRename ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Rename ${displayTitle}`}
                        onClick={() => {
                            setNextTitle(displayTitle);
                            setIsRenaming(true);
                        }}
                    >
                        <PencilLine size={15} />
                    </Button>
                ) : null}
                {onDelete ? (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${displayTitle}`}
                            >
                                <Trash2 size={15} />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Delete {displayTitle}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    This removes the workspace and its progress
                                    from this browser. It cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete}>
                                    Delete workspace
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : null}
            </div>
        </article>
    );
}

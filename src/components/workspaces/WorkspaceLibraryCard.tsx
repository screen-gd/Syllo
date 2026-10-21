"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, PencilLine, Trash2 } from "lucide-react";
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
import { getRelativeTimeLabel, getRoadmapDisplayTitle, getRoadmapStateLabel, getRoadmapStats } from "@/lib/workspace-stats";

interface WorkspaceLibraryCardProps {
    roadmap: Roadmap;
    onDelete?: (id: string) => void;
    onRename?: (id: string, nextTitle: string) => void;
}

export default function WorkspaceLibraryCard({ roadmap, onDelete, onRename }: WorkspaceLibraryCardProps) {
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

    return (
        <article className="interactive-row border-b border-border py-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)] xl:items-start">
                {isRenaming ? (
                    <div className="space-y-3 xl:col-span-2">
                        <label htmlFor={`rename-${roadmap.id}`} className="block text-xs font-semibold text-text-muted">
                            Rename workspace
                        </label>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="min-w-0 flex-1">
                                <Input
                                    id={`rename-${roadmap.id}`}
                                    value={nextTitle}
                                    onChange={(event) => setNextTitle(event.target.value)}
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button type="button" size="sm" onClick={handleRename}>
                                    Save
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setNextTitle(displayTitle);
                                        setIsRenaming(false);
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="min-w-0 space-y-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <h2 className="truncate font-display text-[1.65rem] leading-none text-text">{displayTitle}</h2>
                                <span className="text-xs font-semibold text-text-muted">
                                    {roadmap.mode === "intern" ? "Intern" : "General"}
                                </span>
                            </div>
                            <p className="mt-3 text-sm text-text-muted">{getRoadmapStateLabel(stats.progressState)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button asChild variant="ghost" size="sm" aria-label={`Open ${displayTitle}`}>
                                <Link to="/workspace/$id" params={{ id: roadmap.id }}>
                                    Open
                                    <ArrowRight size={14} />
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-3 text-xs font-semibold text-text-muted sm:grid-cols-4">
                        <span>{stats.moduleCount} modules</span>
                        <span>{getRelativeTimeLabel(roadmap.updatedAt || roadmap.createdAt)}</span>
                        <span>
                            {stats.completedTasks}/{stats.totalTasks} tasks
                        </span>
                        <span>{stats.percent}% complete</span>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-text-muted">
                            <span>Progress</span>
                            <span>{stats.percent}%</span>
                        </div>
                        <div className="h-px overflow-hidden bg-[var(--color-surface-muted)]">
                            <div
                                className={cn(
"h-full transition-[width] duration-300",
                                    stats.progressState === "completed"
                                        ? "bg-[var(--color-text)]"
                                        : stats.progressState === "in-progress"
                                          ? "bg-[var(--color-text-muted)]"
                                          : "bg-[var(--color-text-soft)]",
                                )}
                                style={{ width: `${stats.percent}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-5 xl:pl-6">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="border-t border-border pt-3">
                            <p className="text-xs font-semibold text-text-muted">State</p>
                            <p className="mt-2 text-sm text-text">{getRoadmapStateLabel(stats.progressState)}</p>
                        </div>
                        <div className="border-t border-border pt-3">
                            <p className="text-xs font-semibold text-text-muted">Updated</p>
                            <p className="mt-2 text-sm text-text">{getRelativeTimeLabel(roadmap.updatedAt || roadmap.createdAt)}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                        {onRename ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setNextTitle(displayTitle);
                                    setIsRenaming((current) => !current);
                                }}
                            >
                                <PencilLine size={14} />
                                {isRenaming ? "Editing" : "Rename"}
                            </Button>
                        ) : null}
                        {onDelete ? (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" variant="ghost" size="sm">
                                        <Trash2 size={14} />
                                        Delete
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This removes the workspace from your library. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete}>Delete workspace</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : null}
                    </div>
                </div>
            </div>
        </article>
    );
}

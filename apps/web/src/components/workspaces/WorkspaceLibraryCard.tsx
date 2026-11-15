"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Edit, Icon, TrashCan } from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import {
    Dialog,
    DialogAction,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/glaze/ui/dialog";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemLink,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { Progress } from "@/components/glaze/ui/progress";
import type { Roadmap } from "@/types";
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
    const [confirming, setConfirming] = useState(false);

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
            <Item>
                <ItemContent>
                    <Field>
                        <FieldLabel htmlFor={`rename-${roadmap.id}`}>
                            Rename workspace
                        </FieldLabel>
                        <Input
                            id={`rename-${roadmap.id}`}
                            value={nextTitle}
                            autoFocus
                            onValueChange={setNextTitle}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") handleRename();
                            }}
                        />
                    </Field>
                </ItemContent>
                <ItemActions>
                    <Button size="sm" onClick={handleRename}>
                        Save
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setNextTitle(displayTitle);
                            setIsRenaming(false);
                        }}
                    >
                        Cancel
                    </Button>
                </ItemActions>
            </Item>
        );
    }

    return (
        <>
        <Item>
            <ItemContent>
                <ItemTitle>
                    <ItemLink
                        render={
                            <Link
                                to="/learn"
                                search={{ roadmap: roadmap.id }}
                            />
                        }
                    >
                        {displayTitle}
                    </ItemLink>
                    {roadmap.packVersion ? (
                        <Badge>Built by Scout</Badge>
                    ) : null}
                </ItemTitle>
                <ItemDescription>
                    {stats.moduleCount} module
                    {stats.moduleCount === 1 ? "" : "s"} ·{" "}
                    {getRoadmapStateLabel(stats.progressState)} · {updated} ·{" "}
                    {stats.percent}% ({stats.completedTasks} of{" "}
                    {stats.totalTasks})
                </ItemDescription>
                <Progress
                    className="mt-1 max-w-64"
                    size="sm"
                    value={stats.percent}
                    aria-label={`${displayTitle} progress`}
                />
            </ItemContent>
            <ItemActions>
                {onRename ? (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Rename ${displayTitle}`}
                        onClick={() => {
                            setNextTitle(displayTitle);
                            setIsRenaming(true);
                        }}
                    >
                        <Icon icon={Edit} />
                    </Button>
                ) : null}
                {onDelete ? (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${displayTitle}`}
                        onClick={() => setConfirming(true)}
                    >
                        <Icon icon={TrashCan} />
                    </Button>
                ) : null}
            </ItemActions>
        </Item>
        <Dialog
            role="alertdialog"
            open={confirming}
            onOpenChange={setConfirming}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Delete {displayTitle}?
                    </DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <DialogDescription>
                        This removes the workspace and its progress
                        from this browser. It cannot be undone.
                    </DialogDescription>
                </DialogBody>
                <DialogFooter>
                    <DialogClose>Cancel</DialogClose>
                    <DialogAction
                        variant="destructive"
                        onAction={handleDelete}
                    >
                        Delete workspace
                    </DialogAction>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}

"use client";

import { useState, useEffect } from "react";
import type { Roadmap, ModuleSection, Task } from "@/types";
import { ChevronRight, Icon } from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Checkbox } from "@/components/glaze/ui/checkbox";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemLink,
    ItemMeta,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { Progress } from "@/components/glaze/ui/progress";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/glaze/ui/sheet";
import ContextPanel from "./ContextPanel";
import { useMediaQuery, WIDE_QUERY } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/glaze/utils";

interface Props {
    roadmap: Roadmap;
    onUpdateSubtask: (moduleId: string, taskId: string, subtaskId: string) => void;
    onUpdateTask: (moduleId: string, taskId: string) => void;
    onUpdateModule: (moduleId: string) => void;
    activeModuleId?: string; // If passed from sidebar
}

export type SelectedNode =
    | { type: "module"; id: string; data: ModuleSection }
    | { type: "task"; id: string; moduleId: string; data: Task }
    | null;

export default function WorkspaceSplitView({ roadmap, onUpdateSubtask, onUpdateTask, onUpdateModule, activeModuleId }: Props) {
    const modules = roadmap.sections.filter(s => s.type === "module" || s.type === "milestones") as ModuleSection[];
    const [selectedNode, setSelectedNode] = useState<SelectedNode>(null);
    // Below 1024px the details open in a sheet instead of the side column.
    const wide = useMediaQuery({ query: WIDE_QUERY, serverValue: true });

    // Scroll to module if activeModuleId changes
    useEffect(() => {
        if (activeModuleId) {
            const el = document.getElementById(`module-${activeModuleId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [activeModuleId]);

    const getModuleProgress = (ms: ModuleSection): number => {
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
    };

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* LEFT PANE: module list */}
            <div className="min-w-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex max-w-256 flex-col gap-4 px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-10">

                    <header className="mb-2">
                        <h1 className="type-title">Active roadmap</h1>
                        <p className="mt-1 type-body-sm text-text-2">Follow the path and complete your tasks. Select any item to view its details.</p>
                    </header>

                    {modules.map((mod) => {
                        const progress = getModuleProgress(mod);
                        const isModuleSelected = selectedNode?.type === "module" && selectedNode.id === mod.id;
                        const tasks = mod.data.tasks || [];

                        return (
                            <div key={mod.id} id={`module-${mod.id}`} className="shell">
                                <div className="panel flex flex-col gap-3 p-3">
                                    <Item selected={isModuleSelected}>
                                        <ItemContent>
                                            <ItemTitle className="type-heading-sm">
                                                <ItemLink
                                                    href={`#module-${mod.id}`}
                                                    aria-current={isModuleSelected ? "true" : undefined}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setSelectedNode({ type: "module", id: mod.id, data: mod });
                                                    }}
                                                >
                                                    {mod.title || "Untitled module"}
                                                </ItemLink>
                                            </ItemTitle>
                                            {mod.data.description ? (
                                                <ItemDescription>{mod.data.description}</ItemDescription>
                                            ) : null}
                                        </ItemContent>
                                        <Badge>{progress}%</Badge>
                                    </Item>

                                    <div className="px-3">
                                    <Progress
                                        value={progress}
                                        aria-label={`${mod.title} progress`}
                                    />
                                    </div>

                                    <ItemGroup variant="plain" aria-label={`${mod.title} tasks`}>
                                        {tasks.map(task => {
                                            const isTaskSelected = selectedNode?.type === "task" && selectedNode.id === task.id;
                                            const subtasks = task.subtasks || [];
                                            return (
                                                <Item key={task.id} selected={isTaskSelected}>
                                                    <span className="relative z-(--z-raised) flex">
                                                        <Checkbox
                                                            aria-label={
                                                                task.completed
                                                                    ? `Mark ${task.title} incomplete`
                                                                    : `Mark ${task.title} complete`
                                                            }
                                                            checked={!!task.completed}
                                                            onCheckedChange={() => onUpdateTask(mod.id, task.id)}
                                                        />
                                                    </span>
                                                    <ItemContent>
                                                        <ItemTitle className={cn("transition-colors duration-(--dur-state) ease-out", task.completed && "text-text-2 line-through")}>
                                                            <ItemLink
                                                                href={`#task-${task.id}`}
                                                                aria-current={isTaskSelected ? "true" : undefined}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setSelectedNode({ type: "task", id: task.id, moduleId: mod.id, data: task });
                                                                }}
                                                            >
                                                                {task.title}
                                                            </ItemLink>
                                                        </ItemTitle>
                                                    </ItemContent>
                                                    {subtasks.length > 0 ? (
                                                        <ItemMeta>
                                                            {subtasks.filter(s => s.completed).length}/{subtasks.length}
                                                        </ItemMeta>
                                                    ) : null}
                                                    <Icon icon={ChevronRight} className="text-text-3" />
                                                </Item>
                                            );
                                        })}
                                    </ItemGroup>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT PANE: context */}
            <Sheet
                open={selectedNode !== null && !wide}
                onOpenChange={(open) => {
                    if (!open) setSelectedNode(null);
                }}
            >
                <SheetContent showCloseButton={false}>
                    <SheetHeader className="sr-only">
                        <SheetTitle>
                            {selectedNode?.type === "module"
                                ? selectedNode.data.title
                                : selectedNode?.type === "task"
                                  ? selectedNode.data.title
                                  : "Details"}
                        </SheetTitle>
                    </SheetHeader>
                    {selectedNode && (
                        <ContextPanel
                            selectedNode={selectedNode}
                            roadmap={roadmap}
                            onUpdateSubtask={onUpdateSubtask}
                            onUpdateTask={onUpdateTask}
                            onUpdateModule={onUpdateModule}
                            onClose={() => setSelectedNode(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>
            {selectedNode ? (
                <div className="hidden h-full w-96 shrink-0 flex-col border-s border-line-faint bg-page lg:flex xl:w-md">
                    <ContextPanel
                        selectedNode={selectedNode}
                        roadmap={roadmap}
                        onUpdateSubtask={onUpdateSubtask}
                        onUpdateTask={onUpdateTask}
                        onUpdateModule={onUpdateModule}
                        onClose={() => setSelectedNode(null)}
                    />
                </div>
            ) : (
                <div className="hidden w-96 shrink-0 flex-col items-center justify-center border-s border-line-faint bg-page p-6 lg:flex xl:w-md">
                    <Empty variant="plain">
                        <EmptyHeader>
                            <EmptyTitle>Context panel</EmptyTitle>
                            <EmptyDescription>
                                Select any module or task to view its details,
                                resources, and take notes here.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </div>
            )}

        </div>
    );
}

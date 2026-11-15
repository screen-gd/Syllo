"use client";

import { useState } from "react";
import type { Roadmap, ModuleSection, Task } from "@/types";
import type { SelectedNode } from "./WorkspaceSplitView";
import {
    Attachment,
    BookOpen,
    Check,
    Close,
    Code,
    Document,
    FileVideo,
    Icon,
    Link as LinkIcon,
    Tool,
    Trophy,
} from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from "@/components/glaze/ui/item";
import {
    SegmentedControl,
    SegmentedControlItem,
} from "@/components/glaze/ui/segmented-control";
import { Switch } from "@/components/glaze/ui/switch";
import { Textarea } from "@/components/glaze/ui/textarea";
import SmartEmbed from "@/components/shared/SmartEmbed";
import { cn } from "@/lib/glaze/utils";

interface Props {
    selectedNode: SelectedNode;
    roadmap: Roadmap;
    onUpdateSubtask: (moduleId: string, taskId: string, subtaskId: string) => void;
    onUpdateTask: (moduleId: string, taskId: string) => void;
    onUpdateModule: (moduleId: string) => void;
    onClose: () => void;
}

const RESOURCE_ICONS: Record<string, typeof Document> = {
    video: FileVideo,
    doc: Document,
    pdf: BookOpen,
    link: LinkIcon,
    code: Code,
    tool: Tool,
    course: Trophy,
};

export default function ContextPanel({ selectedNode, onUpdateSubtask, onUpdateTask, onUpdateModule, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<"content" | "notes">("content");

    if (!selectedNode) return null;

    const resourceTypeIcon = (type: string) => RESOURCE_ICONS[type] ?? Attachment;

    const renderTaskContent = () => {
        if (selectedNode.type !== "task") return null;
        const task = selectedNode.data as Task;
        const moduleId = selectedNode.moduleId;

        return (
            <div className="flex flex-col gap-5">
                <div>
                    <h2
                        className={cn(
                            "type-heading transition-colors duration-(--dur-state) ease-out",
                            task.completed && "line-through text-text-2",
                        )}
                    >
                        {task.title}
                    </h2>
                    <div className="mt-2 flex items-center gap-2">
                        <Badge>Task</Badge>
                        {task.priority ? <Badge>{task.priority}</Badge> : null}
                    </div>
                </div>

                {task.completed ? (
                    <Button
                        variant="secondary"
                        onClick={() => onUpdateTask(moduleId, task.id)}
                    >
                        <Icon icon={Check} /> Completed
                    </Button>
                ) : (
                    <Button onClick={() => onUpdateTask(moduleId, task.id)}>
                        Mark as complete
                    </Button>
                )}

                {task.description ? (
                    <div className="well rounded-panel p-3">
                        <h4 className="type-caption text-text-2">Description</h4>
                        <p className="mt-2 whitespace-pre-wrap type-body-sm text-text-1">
                            {task.description}
                        </p>
                    </div>
                ) : null}

                {(task.subtasks || []).length > 0 ? (
                    <div>
                        <h4 className="type-caption text-text-2">
                            Checklist (
                            {task.subtasks!.filter((s) => s.completed).length}/
                            {task.subtasks!.length})
                        </h4>
                        <ul className="mt-1 flex flex-col">
                            {task.subtasks!.map((sub) => (
                                <li
                                    key={sub.id}
                                    className="rule-row flex items-center gap-3 py-2"
                                >
                                    <Switch
                                        size="sm"
                                        aria-label={sub.title}
                                        checked={sub.completed}
                                        onCheckedChange={() =>
                                            onUpdateSubtask(
                                                moduleId,
                                                task.id,
                                                sub.id,
                                            )
                                        }
                                    />
                                    <span
                                        className={cn(
                                            "type-body-sm",
                                            sub.completed
                                                ? "text-text-2 line-through"
                                                : "text-text-1",
                                        )}
                                    >
                                        {sub.title}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </div>
        );
    };

    const renderModuleContent = () => {
        if (selectedNode.type !== "module") return null;
        const mod = selectedNode.data as ModuleSection;
        const data = mod.data;

        return (
            <div className="flex flex-col gap-5">
                <div>
                    <h2 className="type-heading">{mod.title}</h2>
                    <div className="mt-2">
                        <Badge>Module</Badge>
                    </div>
                </div>

                {data.completed ? (
                    <Button
                        variant="secondary"
                        onClick={() => onUpdateModule(mod.id)}
                    >
                        <Icon icon={Check} /> Completed
                    </Button>
                ) : (
                    <Button onClick={() => onUpdateModule(mod.id)}>
                        Mark module complete
                    </Button>
                )}

                {data.description ? (
                    <div>
                        <h4 className="type-caption text-text-2">Overview</h4>
                        <p className="mt-2 type-body-sm text-text-2">
                            {data.description}
                        </p>
                    </div>
                ) : null}

                {data.videos && data.videos.length > 0 ? (
                    <div>
                        <h4 className="type-caption text-text-2">
                            Video resources ({data.videos.length})
                        </h4>
                        <div className="mt-2 flex flex-col gap-3">
                            {data.videos.map((video) => (
                                <div
                                    key={video.id}
                                    className="overflow-hidden rounded-panel border border-line-faint"
                                >
                                    <SmartEmbed url={video.url} title={video.title} />
                                    <div className="border-t border-line-faint bg-paper p-3">
                                        <p className="truncate type-body-sm text-text-1">
                                            {video.title}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {data.resources && data.resources.length > 0 ? (
                    <div>
                        <h4 className="type-caption text-text-2">
                            Learning materials ({data.resources.length})
                        </h4>
                        <ItemGroup variant="plain" aria-label="Learning materials" className="mt-1">
                            {data.resources.map((res) => (
                                <Item
                                    key={res.id}
                                    render={
                                        <a
                                            href={res.url}
                                            target="_blank"
                                            rel="noreferrer"
                                        />
                                    }
                                >
                                    <ItemMedia>
                                        <Icon
                                            icon={resourceTypeIcon(res.type)}
                                        />
                                    </ItemMedia>
                                    <ItemContent>
                                        <ItemTitle>{res.title}</ItemTitle>
                                        {res.description ? (
                                            <ItemDescription>
                                                {res.description}
                                            </ItemDescription>
                                        ) : null}
                                    </ItemContent>
                                    <ItemActions />
                                </Item>
                            ))}
                        </ItemGroup>
                    </div>
                ) : null}
            </div>
        );
    };

    return (
        <>
            {/* Header & Tabs */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-faint p-3">
                <SegmentedControl
                    aria-label="Panel view"
                    value={activeTab}
                    onValueChange={(value) =>
                        setActiveTab(value as "content" | "notes")
                    }
                >
                    <SegmentedControlItem value="content">
                        Content
                    </SegmentedControlItem>
                    <SegmentedControlItem value="notes">
                        My notes
                    </SegmentedControlItem>
                </SegmentedControl>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close panel"
                    onClick={onClose}
                >
                    <Icon icon={Close} />
                </Button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-3">
                {activeTab === "content" ? (
                    selectedNode.type === "module" ? (
                        renderModuleContent()
                    ) : (
                        renderTaskContent()
                    )
                ) : (
                    <Field className="flex h-full flex-col">
                        <FieldLabel className="sr-only">
                            {`Notes for this ${selectedNode.type}`}
                        </FieldLabel>
                        <Textarea
                            className="flex-1"
                            placeholder={
                                "Type your notes for this " +
                                selectedNode.type +
                                " here..."
                            }
                        />
                    </Field>
                )}
            </div>
        </>
    );
}

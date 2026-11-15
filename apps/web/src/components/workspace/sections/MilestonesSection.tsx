"use client";

import { useState } from "react";
import type { MilestoneSection, Section, Milestone } from "@/types";
import VideoPlayer from "@/components/shared/VideoPlayer";
import ContentViewer from "@/components/shared/ContentViewer";
import { ChevronDown, Document, Icon } from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import { Checkbox } from "@/components/glaze/ui/checkbox";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemLink,
    ItemMedia,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { cn } from "@/lib/glaze/utils";

interface Props {
    section: MilestoneSection;
    onUpdate: (updater: (s: Section) => Section) => void;
}

export default function MilestonesSection({ section, onUpdate }: Props) {
    const [expandedId, setExpandedId] = useState<string | null>(section.data[0]?.id || null);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);

    const toggleComplete = (milestoneId: string) => {
        onUpdate((s) => {
            const ms = s as MilestoneSection;
            return {
                ...ms,
                data: (ms.data || []).map((m: Milestone) =>
                    m.id === milestoneId ? { ...m, completed: !m.completed } : m
                ),
            };
        });
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="type-heading">{section.title}</h2>
                <p className="mt-1 type-body-sm text-text-2">Visualize your journey and track major checkpoints.</p>
            </div>

            <ol className="flex flex-col gap-3">
                {(section.data || []).map((milestone, i) => {
                    const isExpanded = expandedId === milestone.id;
                    // Logical "in progress": previous is complete, or we are the first item.
                    const previousCompleted = i === 0 || section.data[i - 1]?.completed;
                    const inProgress = !milestone.completed && previousCompleted;
                    const bodyId = `milestone-${milestone.id}`;

                    return (
                        <li key={milestone.id} className="shell">
                            <div className="panel">
                                <div className="flex items-center gap-3 p-3">
                                    <Checkbox
                                        aria-label={
                                            milestone.completed
                                                ? `Mark ${milestone.title} incomplete`
                                                : `Mark ${milestone.title} complete`
                                        }
                                        checked={!!milestone.completed}
                                        onCheckedChange={() => toggleComplete(milestone.id)}
                                    />
                                    <Button
                                        variant="ghost"
                                        className="min-w-0 flex-1 justify-between"
                                        aria-expanded={isExpanded}
                                        aria-controls={bodyId}
                                        onClick={() => setExpandedId(isExpanded ? null : milestone.id)}
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span
                                                className={cn(
                                                    "truncate type-heading-sm",
                                                    milestone.completed && "text-text-2",
                                                )}
                                            >
                                                {milestone.title}
                                            </span>
                                            {inProgress && <Badge>Active</Badge>}
                                        </span>
                                        <Icon
                                            icon={ChevronDown}
                                            className={cn(
                                                "text-text-3 transition-transform",
                                                isExpanded && "rotate-180",
                                            )}
                                        />
                                    </Button>
                                </div>

                                {isExpanded ? (
                                    <div
                                        id={bodyId}
                                        className="flex flex-col gap-5 border-t border-line-faint p-3"
                                    >
                                        {milestone.description ? (
                                            <p className="whitespace-pre-line type-body-sm text-text-2">
                                                {milestone.description}
                                            </p>
                                        ) : null}

                                        {/* Internal Tasks */}
                                        {(milestone.tasks || []).length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h4 className="type-label">Actions</h4>
                                                <ul className="flex flex-col">
                                                    {(milestone.tasks || []).map((task) => (
                                                        <li key={task.id}>
                                                            <label className="rule-row flex cursor-pointer items-start gap-3 py-2">
                                                                <Checkbox
                                                                    className="mt-0.5"
                                                                    checked={!!task.completed}
                                                                    onCheckedChange={() => {
                                                                        onUpdate((s) => {
                                                                            const ms = s as MilestoneSection;
                                                                            return { ...ms, data: (ms.data || []).map((m: Milestone) => m.id === milestone.id ? { ...m, tasks: (m.tasks || []).map((t) => t.id === task.id ? { ...t, completed: !t.completed } : t) } : m) };
                                                                        });
                                                                    }}
                                                                />
                                                                <span
                                                                    className={cn(
                                                                        "type-body-sm",
                                                                        task.completed ? "text-text-2 line-through" : "text-text-1",
                                                                    )}
                                                                >
                                                                    {task.title}
                                                                </span>
                                                            </label>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Internal Videos */}
                                        {(milestone.videos || []).length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h4 className="type-label">Required viewing</h4>
                                                <div className="flex flex-col gap-4">
                                                    {(milestone.videos || []).map((video) => (
                                                        <div key={video.id} className="overflow-hidden rounded-panel border border-line-faint">
                                                            <VideoPlayer url={video.url} title={video.title} description={video.description} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Internal Resources */}
                                        {(milestone.resources || []).length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h4 className="type-label">Materials</h4>
                                                <ItemGroup variant="plain" aria-label="Materials">
                                                    {(milestone.resources || []).map((res) => (
                                                        <Item key={res.id}>
                                                            <ItemMedia variant="icon">
                                                                <Icon icon={Document} />
                                                            </ItemMedia>
                                                            <ItemContent>
                                                                <ItemTitle>
                                                                    <ItemLink
                                                                        href={res.url}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            setViewerUrl(res.url);
                                                                        }}
                                                                    >
                                                                        {res.title}
                                                                    </ItemLink>
                                                                </ItemTitle>
                                                                {res.description && (
                                                                    <ItemDescription>{res.description}</ItemDescription>
                                                                )}
                                                            </ItemContent>
                                                        </Item>
                                                    ))}
                                                </ItemGroup>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </li>
                    );
                })}
            </ol>

            <ContentViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { TaskSection, Section, TaskGroup, Task } from "@/types";
import { Icon, Time } from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import { Checkbox } from "@/components/glaze/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/glaze/ui/empty-state";
import { cn } from "@/lib/glaze/utils";

interface Props {
    section: TaskSection;
    onUpdate: (updater: (s: Section) => Section) => void;
}

export default function TaskListSection({ section, onUpdate }: Props) {
    const [focusedTaskPath, setFocusedTaskPath] = useState<{g: number, t: number} | null>(null);

    // Flatten tasks for navigation
    const allTasks = (section.data || []).flatMap((g, gIdx) => 
        (g.tasks || []).map((t, tIdx) => ({ groupId: g.id, taskId: t.id, gIdx, tIdx, original: t }))
    );

    const toggleComplete = useCallback((groupId: string, taskId: string, subtaskId?: string) => {
        onUpdate((s) => {
            const ts = s as TaskSection;
            return {
                ...ts,
                data: (ts.data || []).map((g: TaskGroup) => {
                    if (g.id !== groupId) return g;
                    return {
                        ...g,
                        tasks: (g.tasks || []).map((t: Task) => {
                            if (t.id !== taskId) return t;
                            if (subtaskId) {
                                return {
                                    ...t,
                                    subtasks: (t.subtasks || []).map((st) =>
                                        st.id === subtaskId ? { ...st, completed: !st.completed } : st
                                    ),
                                };
                            }
                            return { ...t, completed: !t.completed };
                        }),
                    };
                }),
            };
        });
    }, [onUpdate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const el = e.currentTarget as HTMLElement;
            if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text') return;
            if (el.tagName === 'TEXTAREA') return;

            if (e.key === 'j' || e.key === 'J') {
                e.preventDefault();
                setFocusedTaskPath(prev => {
                    if (!prev) return allTasks.length > 0 ? {g: allTasks[0].gIdx, t: allTasks[0].tIdx} : null;
                    const idx = allTasks.findIndex(t => t.gIdx === prev.g && t.tIdx === prev.t);
                    if (idx < allTasks.length - 1) {
                        return {g: allTasks[idx + 1].gIdx, t: allTasks[idx + 1].tIdx};
                    }
                    return prev;
                });
            } else if (e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                setFocusedTaskPath(prev => {
                    if (!prev) return null;
                    const idx = allTasks.findIndex(t => t.gIdx === prev.g && t.tIdx === prev.t);
                    if (idx > 0) {
                        return {g: allTasks[idx - 1].gIdx, t: allTasks[idx - 1].tIdx};
                    }
                    return prev;
                });
            } else if (e.key === ' ') {
                if (focusedTaskPath) {
                    const task = allTasks.find(t => t.gIdx === focusedTaskPath.g && t.tIdx === focusedTaskPath.t);
                    if (task) {
                        e.preventDefault();
                        toggleComplete(task.groupId, task.taskId);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [allTasks, focusedTaskPath, toggleComplete]);

    const clearCompleted = (groupId: string) => {
        onUpdate((s) => {
            const ts = s as TaskSection;
            return {
                ...ts,
                data: (ts.data || []).map((g: TaskGroup) => {
                    if (g.id !== groupId) return g;
                    return {
                        ...g,
                        tasks: (g.tasks || []).filter((t: Task) => !t.completed),
                    };
                }),
            };
        });
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="type-heading">{section.title}</h2>
                <p className="mt-1 type-body-sm text-text-2">Actionable items to keep you moving forward.</p>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                {(section.data || []).map((group) => {
                    const totalCount = (group.tasks || []).length;
                    const completedCount = (group.tasks || []).filter(t => t.completed).length;

                    return (
                        <div key={group.id} className="shell">
                            <div className="panel p-4">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <h3 className="type-heading-sm">{group.title}</h3>
                                    <div className="flex items-center gap-2">
                                        <Badge>{completedCount} / {totalCount} done</Badge>
                                        {completedCount > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => clearCompleted(group.id)}
                                            >
                                                Clear done
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {(group.tasks || []).length === 0 ? (
                                    <Empty>
                                        <EmptyHeader>
                                            <EmptyTitle>All tasks completed</EmptyTitle>
                                        </EmptyHeader>
                                    </Empty>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {(group.tasks || []).map((task) => {
                                            const focused =
                                                focusedTaskPath?.g === section.data.indexOf(group) &&
                                                focusedTaskPath?.t === group.tasks.indexOf(task);
                                            return (
                                                <li
                                                    key={task.id}
                                                    className={cn(
                                                        "rounded-panel border p-3",
                                                        focused ? "border-line-focus" : "border-line-faint",
                                                    )}
                                                >
                                                    <label className="flex cursor-pointer items-start gap-3">
                                                        <Checkbox
                                                            className="mt-0.5"
                                                            checked={!!task.completed}
                                                            onCheckedChange={() => toggleComplete(group.id, task.id)}
                                                        />
                                                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                                            <span
                                                                className={cn(
                                                                    "type-body-sm",
                                                                    task.completed ? "text-text-2 line-through" : "text-text-1",
                                                                )}
                                                            >
                                                                {task.title}
                                                            </span>
                                                            {task.priority && (
                                                                <Badge>
                                                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                                                </Badge>
                                                            )}
                                                            {task.estimatedTime && (
                                                                <span className="inline-flex items-center gap-1 type-caption text-text-2">
                                                                    <Icon icon={Time} className="text-text-3" />
                                                                    {task.estimatedTime}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </label>

                                                    {/* Subtasks */}
                                                    {!task.completed && task.subtasks && task.subtasks.length > 0 && (
                                                        <ul className="mt-3 ms-7 flex flex-col gap-2">
                                                            {(task.subtasks || []).map((st) => (
                                                                <li key={st.id}>
                                                                    <label className="flex cursor-pointer items-start gap-2">
                                                                        <Checkbox
                                                                            className="mt-0.5"
                                                                            checked={!!st.completed}
                                                                            onCheckedChange={() => toggleComplete(group.id, task.id, st.id)}
                                                                        />
                                                                        <span
                                                                            className={cn(
                                                                                "type-caption",
                                                                                st.completed ? "text-text-2 line-through" : "text-text-1",
                                                                            )}
                                                                        >
                                                                            {st.title}
                                                                        </span>
                                                                    </label>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

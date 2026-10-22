"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock } from "lucide-react";
import type { TaskSection, Section, TaskGroup, Task } from "@/types";

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
        <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center sm:text-left">
                <h2 className="text-2xl font-semibold text-text mb-2 drop-shadow-md">
                    ✅ {section.title}
                </h2>
                <p className="text-text-muted text-sm">Actionable items to keep you moving forward.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {(section.data || []).map((group, i) => {
                    const totalCount = (group.tasks || []).length;
                    const completedCount = (group.tasks || []).filter(t => t.completed).length;

                    return (
                        <div
                            key={group.id}
                            className="surface rounded-2xl p-5 sm:p-6 shadow-lg transition-all duration-300 border border-border animate-slide-up hover:-translate-y-1 group"
                            style={{ animationDelay: `${i * 0.05}s` }}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-display font-bold text-text text-sm text-text flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-accent" />
                                    {group.title}
                                </h3>
                                <div className="flex items-center gap-3">
                                    <span className="bg-surface-muted px-2.5 py-1 rounded-full text-[12px] font-bold text-text-muted border border-border shadow-inner">
                                        {completedCount} / {totalCount} done
                                    </span>
                                    {completedCount > 0 && (
                                        <button
                                            onClick={() => clearCompleted(group.id)}
                                            className="text-xs font-bold text-accent hover:text-accent transition-colors opacity-0 group-hover:opacity-100 px-2 py-1 hover:bg-accent/10 rounded"
                                        >
                                            Clear Done
                                        </button>
                                    )}
                                </div>
                            </div>

                            {(group.tasks || []).length === 0 ? (
                                <div className="py-8 text-center border border-dashed border-border rounded-xl bg-surface/60">
                                    <p className="text-text-muted text-sm italic">All tasks completed! 🎉</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(group.tasks || []).map((task) => (
                                        <div
                                            key={task.id}
                                            className={`relative bg-surface-muted/40 border rounded-xl p-3 sm:p-4 transition-all duration-500 ease-out hover:bg-surface-subtle hover:border-border ${task.completed ? "opacity-40  grayscale" : "opacity-100 "} ${focusedTaskPath?.g === section.data.indexOf(group) && focusedTaskPath?.t === group.tasks.indexOf(task) ? "border-accent " : "border-border"}`}
                                        >
                                            <label className="flex items-start gap-3 cursor-pointer group/label">
                                                <div className="relative flex items-center justify-center w-5 h-5 mt-0.5 shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={task.completed}
                                                        onChange={() => toggleComplete(group.id, task.id)}
                                                        className="peer appearance-none w-5 h-5 rounded-md border border-border-strong bg-surface checked:bg-accent checked:border-accent transition-all cursor-pointer hover:border-accent shadow-inner"
                                                    />
                                                    <span className="absolute text-text text-[12px] font-semibold pointer-events-none opacity-0 peer-checked:opacity-100 drop-shadow-md">✓</span>
                                                </div>
                                                <div className="flex-1 min-w-0 pt-0.5">
                                                    <span
                                                        className={`block text-sm sm:text-base transition-all duration-300 font-medium ${task.completed
                                                            ? "text-text-muted line-through decoration-text-soft"
                                                            : "text-text group-hover/label:text-accent-strong"
                                                            }`}
                                                    >
                                                        {task.title}
                                                        {task.priority && (
                                                            <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                                                task.priority === 'core' ? 'bg-accent/10 text-accent' :
                                                                task.priority === 'optional' ? 'bg-raised/10 text-text-muted' :
                                                                task.priority === 'advanced' ? 'bg-warning/10 text-warning' : ''
                                                            }`}>
                                                                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                                            </span>
                                                        )}
                                                        {task.estimatedTime && (
                                                            <span className="ml-3 inline-flex items-center gap-1 text-[12px] text-text-muted opacity-70">
                                                                <Clock size={12} />
                                                                {task.estimatedTime}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </label>

                                            {/* Subtasks */}
                                            {!task.completed && task.subtasks && task.subtasks.length > 0 && (
                                                <div className="mt-3 ml-8 space-y-2 border-l border-border pl-3">
                                                    {(task.subtasks || []).map((st) => (
                                                        <label
                                                            key={st.id}
                                                            className="flex items-start gap-2 cursor-pointer group/sub"
                                                        >
                                                            <div className="relative flex items-center justify-center w-4 h-4 shrink-0 mt-0.5">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={st.completed}
                                                                    onChange={() => toggleComplete(group.id, task.id, st.id)}
                                                                    className="peer appearance-none w-4 h-4 rounded border border-border-strong bg-surface checked:bg-accent checked:border-accent transition-all cursor-pointer hover:border-accent"
                                                                />
                                                                <span className="absolute text-text text-xs font-semibold pointer-events-none opacity-0 peer-checked:opacity-100">✓</span>
                                                            </div>
                                                            <span
                                                                className={`text-xs transition-colors duration-200 mt-0.5 ${st.completed
                                                                    ? "text-text-muted line-through"
                                                                    : "text-text-muted group-hover/sub:text-text"
                                                                    }`}
                                                            >
                                                                {st.title}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import type { MilestoneSection, Section, Milestone } from "@/types";
import VideoPlayer from "@/components/shared/VideoPlayer";
import ContentViewer from "@/components/shared/ContentViewer";

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
        <div className="max-w-4xl mx-auto">
            <div className="mb-10 text-center sm:text-left">
                <h2 className="font-display text-3xl font-black text-text-primary mb-2 drop-shadow-md">
                    🏁 {section.title}
                </h2>
                <p className="text-text-secondary text-sm">Visualize your journey and track major checkpoints.</p>
            </div>

            {/* Timeline */}
            <div className="relative isolate px-2 sm:px-0">
                {/* Glow behind the line */}
                <div className="absolute left-6 top-4 bottom-4 w-1 bg-indigo-500/20 blur-sm rounded-full hidden sm:block" />
                {/* Vertical line structure */}
                <div className="absolute left-[23.5px] top-4 bottom-8 w-1 sm:block hidden rounded-full bg-gradient-to-b from-indigo-500 via-border/50 to-transparent" />

                <div className="space-y-6">
                    {(section.data || []).map((milestone, i) => {
                        const isExpanded = expandedId === milestone.id;
                        // Logical "in progress": previous is complete, or we are the first item.
                        const previousCompleted = i === 0 || section.data[i - 1]?.completed;
                        const inProgress = !milestone.completed && previousCompleted;

                        const stateColor = milestone.completed
                            ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                            : inProgress
                                ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_30px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/20"
                                : "border-border bg-obsidian-surface/50 opacity-80 hover:opacity-100";

                        const dotColor = milestone.completed
                            ? "bg-emerald-500 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]"
                            : inProgress
                                ? "bg-obsidian border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]"
                                : "bg-obsidian border-border";

                        return (
                            <div
                                key={milestone.id}
                                className="relative sm:pl-16 animate-slide-up"
                                style={{ animationDelay: `${i * 0.08}s` }}
                            >
                                {/* Timeline connector visual dot */}
                                <div className="absolute left-4 top-8 -translate-x-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center z-10">
                                    <div className={`w-4 h-4 rounded-full border-2 transition-all duration-500 ease-out ${dotColor}`} />
                                </div>

                                <div className={`rounded-2xl overflow-hidden transition-all duration-500 border-l-[3px] border-r border-t border-b hover:-translate-y-1 backdrop-blur-sm ${stateColor} ${isExpanded && !inProgress && !milestone.completed ? "ring-1 ring-white/10" : ""}`}>

                                    {/* Header click area */}
                                    <button
                                        type="button"
                                        className="w-full flex items-center gap-4 p-5 sm:p-6 text-left group"
                                        onClick={() => setExpandedId(isExpanded ? null : milestone.id)}
                                    >
                                        <div
                                            className={`relative flex items-center justify-center w-6 h-6 rounded flex-shrink-0 transition-all duration-300 ${milestone.completed ? 'bg-emerald-500' : 'bg-obsidian-elevated border border-border-subtle group-hover:border-indigo-400'
                                                }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleComplete(milestone.id);
                                            }}
                                        >
                                            {milestone.completed && <span className="text-white text-[12px] font-bold shadow-sm">✓</span>}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-display font-bold text-[17px] transition-colors duration-300 ${milestone.completed ? "text-text-secondary" : "text-text-primary"
                                                    } ${inProgress && !milestone.completed ? 'text-indigo-50' : ''}`}>
                                                    {milestone.title}
                                                </h3>
                                                {inProgress && <span className="px-2 py-0.5 rounded text-[12px] font-bold uppercase tracking-wide bg-indigo-500/20 text-indigo-300 animate-pulse border border-indigo-500/30">Active</span>}
                                            </div>
                                            <p className={`text-sm mt-1 line-clamp-1 transition-colors ${milestone.completed ? "text-text-secondary/50" : "text-text-secondary"}`}>
                                                {milestone.description}
                                            </p>
                                        </div>

                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white/5 transition-transform duration-300 group-hover:bg-white/10 ${isExpanded ? "rotate-180 bg-white/10" : ""}`}>
                                            <span className="text-[12px] text-text-secondary group-hover:text-text-primary">▼</span>
                                        </div>
                                    </button>

                                    {/* Accordion Expandable body */}
                                    <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                                        <div className="overflow-hidden">
                                            <div className="px-5 sm:px-6 pb-6 pt-2 space-y-8 border-t border-border mx-2 bg-gradient-to-b from-transparent to-obsidian/30">

                                                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line bg-obsidian-surface/60 p-4 rounded-xl border border-border shadow-inner">
                                                    {milestone.description}
                                                </p>

                                                {/* Internal Tasks */}
                                                {(milestone.tasks || []).length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-widest px-1">
                                                            <span className="text-indigo-400 drop-shadow-[0_0_3px_rgba(99,102,241,0.5)]">⚡</span> Actions
                                                        </h4>
                                                        <div className="space-y-2 grid grid-cols-1">
                                                            {(milestone.tasks || []).map((task) => (
                                                                <label key={task.id} className={`group relative flex items-start gap-3 p-3 rounded-xl hover:bg-obsidian-hover border border-border cursor-pointer transition-all duration-300 ${task.completed ? "bg-emerald-500/5 border-emerald-500/10" : "bg-obsidian-elevated/40"}`}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={task.completed}
                                                                        onChange={() => {
                                                                            onUpdate((s) => {
                                                                                const ms = s as MilestoneSection;
                                                                                return { ...ms, data: (ms.data || []).map((m: Milestone) => m.id === milestone.id ? { ...m, tasks: (m.tasks || []).map((t) => t.id === task.id ? { ...t, completed: !t.completed } : t) } : m) };
                                                                            });
                                                                        }}
                                                                        className="mt-1 w-4 h-4 rounded transition-colors accent-indigo-500 border-border-subtle cursor-pointer"
                                                                    />
                                                                    <span className={`text-sm leading-relaxed transition-all duration-300 ${task.completed ? "text-text-secondary line-through decoration-white/20" : "text-text-primary group-hover:text-indigo-100"}`}>
                                                                        {task.title}
                                                                    </span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Internal Videos */}
                                                {(milestone.videos || []).length > 0 && (
                                                    <div className="space-y-4">
                                                        <h4 className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-widest px-1">
                                                            <span className="text-rose-400 drop-shadow-[0_0_3px_rgba(251,113,133,0.5)]">🎥</span> Required Viewing
                                                        </h4>
                                                        <div className="grid grid-cols-1 gap-4">
                                                            {(milestone.videos || []).map((video) => (
                                                                <div key={video.id} className="rounded-xl overflow-hidden border border-border shadow-lg bg-obsidian relative group">
                                                                    <VideoPlayer url={video.url} title={video.title} description={video.description} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Internal Resources */}
                                                {(milestone.resources || []).length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-widest px-1">
                                                            <span className="text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]">📚</span> Materials
                                                        </h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {(milestone.resources || []).map((res) => (
                                                                <button
                                                                    key={res.id}
                                                                    type="button"
                                                                    className="flex items-start gap-3 p-3 rounded-xl bg-obsidian-elevated/40 hover:bg-obsidian-hover border border-border text-left transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-lg"
                                                                    onClick={() => setViewerUrl(res.url)}
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-sm shrink-0 border border-cyan-500/20 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all">
                                                                        <span className="drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">📄</span>
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <span className="text-sm font-medium text-cyan-200 group-hover:text-cyan-100 block truncate transition-colors">{res.title}</span>
                                                                        {res.description && <span className="text-[12px] text-text-secondary block truncate mt-0.5">{res.description}</span>}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {viewerUrl && (
                <ContentViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
            )}
        </div>
    );
}

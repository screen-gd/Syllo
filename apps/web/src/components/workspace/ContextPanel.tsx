"use client";

import { useState } from "react";
import type { Roadmap, Section, ModuleSection, Task } from "@/types";
import type { SelectedNode } from "./WorkspaceSplitView";
import { CheckCircle2, Circle, X, BookOpen, Video, FileText, Code2, Link2, Wrench, GraduationCap, Paperclip, ChevronRight, Play } from "lucide-react";
import SmartEmbed from "@/components/shared/SmartEmbed";
import { cn } from "@/lib/utils";

interface Props {
    selectedNode: SelectedNode;
    roadmap: Roadmap;
    onUpdateSubtask: (moduleId: string, taskId: string, subtaskId: string) => void;
    onUpdateTask: (moduleId: string, taskId: string) => void;
    onUpdateModule: (moduleId: string) => void;
    onClose: () => void;
}

export default function ContextPanel({ selectedNode, roadmap, onUpdateSubtask, onUpdateTask, onUpdateModule, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<"content" | "notes">("content");

    if (!selectedNode) return null;

    const resourceTypeIcon = (type: string) => {
        switch (type) {
            case "video": return <Video size={16} />;
            case "doc": return <FileText size={16} />;
            case "pdf": return <BookOpen size={16} />;
            case "link": return <Link2 size={16} />;
            case "code": return <Code2 size={16} />;
            case "tool": return <Wrench size={16} />;
            case "course": return <GraduationCap size={16} />;
            default: return <Paperclip size={16} />;
        }
    };

    const renderTaskContent = () => {
        if (selectedNode.type !== "task") return null;
        const task = selectedNode.data as Task;
        const moduleId = selectedNode.moduleId;
        
        return (
            <div className="space-y-8 animate-in fade-in duration-300">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-bold">Task</span>
                            {task.priority && (
                                <span className={cn(
"px-2 py-0.5 rounded text-xs   font-bold",
                                    task.priority === 'core' ? 'bg-accent/10 text-accent' : 'bg-[var(--color-surface-muted)] text-text-muted'
                                )}>{task.priority}</span>
                            )}
                        </div>
                        <h2 className={cn("text-2xl font-display text-text leading-tight", task.completed && "line-through text-text-muted")}>
                            {task.title}
                        </h2>
                    </div>
                </div>

                <button 
                    onClick={() => onUpdateTask(moduleId, task.id)}
                    className={cn(
"w-full flex justify-center items-center gap-2 py-3 rounded-lg border font-semibold text-sm transition-all",
                        task.completed 
                            ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20" 
                            : "bg-text border-accent text-page hover:bg-[#e6e6e6]"
                    )}
                >
                    {task.completed ? <><CheckCircle2 size={16} /> Completed</> : "Mark as Complete"}
                </button>

                {task.description && (
                    <div className="p-5 rounded-xl border border-border bg-[var(--color-surface)]">
                        <h4 className="text-xs font-semibold text-text-muted mb-3">Description</h4>
                        <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{task.description}</p>
                    </div>
                )}

                {(task.subtasks || []).length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold text-text-muted mb-4">Checklist ({task.subtasks!.filter(s=>s.completed).length}/{task.subtasks!.length})</h4>
                        <div className="space-y-2">
                            {task.subtasks!.map(sub => (
                                <button
                                    key={sub.id}
                                    onClick={() => onUpdateSubtask(moduleId, task.id, sub.id)}
                                    className="w-full flex items-start gap-3 p-3 rounded-lg border border-border bg-[var(--color-surface)] hover:border-text-soft transition-colors text-left group"
                                >
                                    <div className={cn(
"mt-0.5 shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors",
                                        sub.completed ? "bg-accent border-accent text-page" : "border-text-muted group-hover:border-accent/50"
                                    )}>
                                        {sub.completed && <CheckCircle2 size={12} />}
                                    </div>
                                    <span className={cn("text-sm", sub.completed ? "text-text-muted line-through" : "text-text")}>
                                        {sub.title}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )
    };

    const renderModuleContent = () => {
        if (selectedNode.type !== "module") return null;
        const mod = selectedNode.data as ModuleSection;
        const data = mod.data;

        return (
            <div className="space-y-8 animate-in fade-in duration-300">
                <div>
                     <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-bold">Module</span>
                    </div>
                    <h2 className="text-3xl font-display text-text leading-tight">{mod.title}</h2>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => onUpdateModule(mod.id)}
                        className={cn(
"flex-1 flex justify-center items-center gap-2 py-3 rounded-lg border font-semibold text-sm transition-all",
                            data.completed 
                                ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20" 
                                : "bg-surface border-border text-text hover:border-text-soft"
                        )}
                    >
                        {data.completed ? <><CheckCircle2 size={16} /> Completed</> : "Mark Module Complete"}
                    </button>
                </div>

                {data.description && (
                    <div>
                        <h4 className="text-xs font-semibold text-text-muted mb-3">Overview</h4>
                        <p className="text-base text-text-muted leading-relaxed">{data.description}</p>
                    </div>
                )}

                {data.videos && data.videos.length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold text-text-muted mb-4">Video Resources ({data.videos.length})</h4>
                        <div className="space-y-4">
                            {data.videos.map(video => (
                                <div key={video.id} className="rounded-xl overflow-hidden border border-border">
                                    <SmartEmbed url={video.url} title={video.title} />
                                    <div className="p-3 bg-[var(--color-surface)] border-t border-border">
                                        <p className="text-sm font-medium text-text truncate">{video.title}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {data.resources && data.resources.length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold text-text-muted mb-4">Learning Materials ({data.resources.length})</h4>
                        <div className="grid gap-3">
                            {data.resources.map(res => (
                                <a 
                                    key={res.id} 
                                    href={res.url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-start gap-4 p-4 rounded-xl border border-border bg-[var(--color-surface)] hover:border-text-soft hover:shadow-md transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-muted)] flex items-center justify-center text-text-muted shrink-0 group-hover:text-accent transition-colors">
                                        {resourceTypeIcon(res.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h5 className="font-medium text-sm text-text truncate">{res.title}</h5>
                                        {res.description && <p className="text-xs text-text-muted line-clamp-1 mt-1">{res.description}</p>}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            {/* Header & Tabs */}
            <div className="shrink-0 flex items-center justify-between px-6 pt-6 pb-0 border-b border-border">
                <div className="flex gap-6">
                    <button 
                        onClick={() => setActiveTab("content")}
                        className={cn(
"pb-4 text-sm font-semibold transition-colors border-b-2",
                            activeTab === "content" ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text"
                        )}
                    >
                        Content
                    </button>
                    <button 
                        onClick={() => setActiveTab("notes")}
                        className={cn(
"pb-4 text-sm font-semibold transition-colors border-b-2",
                            activeTab === "notes" ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text"
                        )}
                    >
                        My Notes
                    </button>
                </div>
                <button 
                    onClick={onClose} 
                    className="mb-4 p-2 rounded-lg text-text-muted hover:bg-[var(--color-surface-muted)] hover:text-text transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {activeTab === "content" ? (
                    selectedNode.type === "module" ? renderModuleContent() : renderTaskContent()
                ) : (
                    <div className="h-full flex flex-col">
                        <textarea 
                            className="flex-1 w-full p-4 bg-transparent border border-border rounded-xl resize-none focus:outline-none focus:border-accent text-sm leading-relaxed"
                            placeholder={"Type your notes for this " + selectedNode.type + " here..."}
                        />
                    </div>
                )}
            </div>
        </>
    );
}

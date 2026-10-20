"use client";

import { useMemo, useState, useEffect } from "react";
import type { Roadmap, Section, ModuleSection, Task } from "@/types";
import { CheckCircle2, Circle, Clock, ChevronRight, Play, FileText, Target, BookOpen } from "lucide-react";
import ContextPanel from "./ContextPanel";
import { cn } from "@/lib/utils";

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
        <div className="flex h-full w-full overflow-hidden animate-in fade-in duration-300">
            {/* LEFT PANE: 60% TIMELINE */}
            <div className={cn(
                "flex-1 overflow-y-auto no-scrollbar border-r border-white/10 transition-all duration-300",
                selectedNode ? "lg:w-[65%] lg:flex-none lg:max-w-[65%]" : "w-full"
            )}>
                <div className="max-w-3xl mx-auto p-8 lg:p-12 pb-32 space-y-12">
                    
                    <header className="mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                           Timeline View
                        </div>
                        <h1 className="text-3xl font-display text-zinc-100 tracking-tight">Active Roadmap</h1>
                        <p className="text-zinc-400 mt-2">Follow the path and complete your tasks. Select any item to view its details.</p>
                    </header>

                    <div className="relative border-l-2 border-white/10 ml-4 space-y-12">
                        {modules.map((mod, i) => {
                            const progress = getModuleProgress(mod);
                            const isModuleSelected = selectedNode?.type === "module" && selectedNode.id === mod.id;
                            const tasks = mod.data.tasks || [];

                            return (
                                <div key={mod.id} id={`module-${mod.id}`} className="relative group">
                                    {/* Timeline dot */}
                                    <div className="absolute -left-[29px] top-4 w-14 h-14 bg-zinc-950 rounded-full flex items-center justify-center">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]",
                                            progress === 100 ? "bg-emerald-500 border-emerald-400 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]" : 
                                            progress > 0 ? "border-emerald-500 text-emerald-400 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : 
                                            "border-white/10 text-zinc-500 bg-white/5"
                                        )}>
                                            {progress === 100 ? <CheckCircle2 size={20} /> : i + 1}
                                        </div>
                                    </div>

                                    {/* Module Card */}
                                    <div className="ml-12">
                                        <button 
                                            onClick={() => setSelectedNode({ type: "module", id: mod.id, data: mod })}
                                            className={cn(
                                                "w-full text-left p-6 rounded-2xl border transition-all duration-300 ease-in-out hover:scale-[1.01] hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]",
                                                isModuleSelected ? "border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "border-white/10 bg-white/5 hover:border-white/20"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="font-display text-xl text-zinc-100">{mod.title || "Untitled Module"}</h3>
                                                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">{progress}%</span>
                                            </div>
                                            {mod.data.description && (
                                                <p className="text-sm text-text-secondary line-clamp-2">{mod.data.description}</p>
                                            )}
                                            
                                            {/* Condensed tasks preview if not expanded into details */}
                                            <div className="mt-6 space-y-2">
                                                {tasks.map(task => {
                                                    const isTaskSelected = selectedNode?.type === "task" && selectedNode.id === task.id;
                                                    return (
                                                        <div 
                                                            key={task.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedNode({ type: "task", id: task.id, moduleId: mod.id, data: task });
                                                            }}
                                                            className={cn(
                                                                "group/task flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer",
                                                                isTaskSelected ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10"
                                                            )}
                                                        >
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onUpdateTask(mod.id, task.id);
                                                                }}
                                                                className={cn(
                                                                    "mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded-sm border transition-all duration-300 cursor-pointer",
                                                                    task.completed ? "bg-emerald-500 border-emerald-400 text-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "border-zinc-600 bg-zinc-900 hover:border-emerald-500/50"
                                                                )}
                                                            >
                                                                {task.completed && <CheckCircle2 size={14} />}
                                                            </button>
                                                            <div className="flex-1">
                                                                <h4 className={cn("text-sm font-medium transition-all duration-300", task.completed ? "text-zinc-500 line-through" : "text-zinc-200")}>
                                                                    {task.title}
                                                                </h4>
                                                                {(task.subtasks || []).length > 0 && (
                                                                    <div className="mt-2 flex gap-1.5 flex-wrap">
                                                                        {task.subtasks!.map(sub => (
                                                                            <span key={sub.id} className={cn("w-2 h-2 rounded-full transition-all duration-300", sub.completed ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-zinc-700")} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <ChevronRight size={16} className={cn("text-zinc-600 transition-transform duration-300", isTaskSelected && "text-emerald-400 translate-x-1", "group-hover/task:text-zinc-400 group-hover/task:translate-x-0.5")} />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )
                        })}

                        {/* End of Timeline marker */}
                        <div className="relative !mt-6">
                            <div className="absolute -left-[14px] top-0 w-8 h-8 rounded-full border-2 border-dashed border-white/20 bg-zinc-950 flex items-center justify-center pointer-events-none">
                                <Target size={14} className="text-zinc-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT PANE: 35% CONTEXT */}
            {selectedNode ? (
                <div className="w-[35%] bg-zinc-950/50 backdrop-blur-xl flex flex-col h-full hidden lg:flex border-l border-white/10 animate-in slide-in-from-right-8 duration-500 shadow-2xl">
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
                <div className="w-[35%] bg-zinc-950/50 backdrop-blur-xl hidden lg:flex flex-col items-center justify-center p-12 text-center border-l border-white/10 shadow-inner">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 mb-6 drop-shadow-md">
                        <BookOpen size={24} />
                    </div>
                    <h3 className="text-xl font-display text-zinc-100 mb-2 tracking-tight">Context Panel</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">Select any module or task on the timeline to view its details, resources, and take notes here.</p>
                </div>
            )}
            
            {/* Mobile drawer overlay for ContextPanel can be added here if needed */}
        </div>
    );
}

"use client";

import { useState } from "react";
import type { NoteSection, Section, Note } from "@/types";

interface Props {
    section: NoteSection;
    onUpdate: (updater: (s: Section) => Section) => void;
}

export default function Notes({ section, onUpdate }: Props) {
    const [activeNoteId, setActiveNoteId] = useState<string>(
        section.data[0]?.id || ""
    );

    const activeNote = section.data.find((n) => n.id === activeNoteId) || section.data[0];

    const updateNote = (noteId: string, updates: Partial<Note>) => {
        onUpdate((s) => {
            const ns = s as NoteSection;
            return {
                ...ns,
                data: ns.data.map((n) => (n.id === noteId ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n)),
            };
        });
    };

    const addNote = () => {
        const newNote: Note = {
            id: crypto.randomUUID(),
            title: "Untitled Note",
            content: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        onUpdate((s) => {
            const ns = s as NoteSection;
            return { ...ns, data: [newNote, ...ns.data] };
        });
        setActiveNoteId(newNote.id);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter") {
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const value = target.value;

            const currentLineStart = value.lastIndexOf("\n", start - 1) + 1;
            const currentLine = value.substring(currentLineStart, start);
            const match = currentLine.match(/^(\s*)([-*]\s|\d+\.\s)/);

            if (match) {
                e.preventDefault();
                const indent = match[1] + match[2];
                const newContent = value.substring(0, start) + "\n" + indent + value.substring(target.selectionEnd);
                updateNote(activeNote.id, { content: newContent });

                setTimeout(() => {
                    target.selectionStart = target.selectionEnd = start + 1 + indent.length;
                }, 0);
            }
        }
    };

    const wordCount = activeNote?.content.trim().split(/\s+/).filter(Boolean).length || 0;

    return (
        <div className="max-w-6xl mx-auto h-[max(calc(100vh-160px),600px)] flex flex-col lg:flex-row gap-6 animate-fade-in relative z-10">

            {/* Sidebar List */}
            <div className="w-full lg:w-80 shrink-0 flex flex-col min-h-0 surface rounded-2xl border border-border shadow-xl animate-slide-up bg-obsidian-surface/60 backdrop-blur-sm">
                <div className="p-5 border-b border-border/50 flex items-center justify-between z-10 sticky top-0 bg-obsidian-surface backdrop-blur-xl rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <h2 className="font-display text-lg font-black text-text-primary tracking-wide">📝 Notes</h2>
                    </div>
                    <button
                        onClick={addNote}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                        title="Create new note"
                    >
                        +
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {section.data.map((note) => {
                        const isActive = note.id === activeNoteId;
                        return (
                            <button
                                key={note.id}
                                onClick={() => setActiveNoteId(note.id)}
                                className={`w-full text-left p-4 rounded-xl transition-all duration-300 group overflow-hidden relative ${isActive
                                    ? "bg-indigo-500/10 border border-indigo-500/20 shadow-[0_5px_15px_-5px_rgba(99,102,241,0.2)]"
                                    : "hover:bg-obsidian border border-transparent hover:border-border"
                                    }`}
                            >
                                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,1)]" />}

                                <h3 className={`font-bold transition-colors truncate mb-1 ${isActive ? "text-indigo-300" : "text-text-primary group-hover:text-indigo-200"}`}>
                                    {note.title || "Untitled Note"}
                                </h3>
                                <p className="text-sm text-text-secondary truncate">
                                    {new Intl.DateTimeFormat("en-US", { dateStyle: "short" }).format(new Date(note.updatedAt))}
                                </p>
                            </button>
                        );
                    })}
                    {section.data.length === 0 && (
                        <div className="p-6 text-center text-text-secondary text-sm border border-dashed border-border-subtle rounded-xl m-2">
                            No notes yet. Click the + button to create one.
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Main */}
            {activeNote ? (
                <div className="flex-1 flex flex-col min-h-0 surface rounded-2xl border border-border shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] bg-obsidian animate-slide-up shadow-indigo-500/5 relative overflow-hidden" style={{ animationDelay: '0.1s' }}>

                    {/* Editor glow effect inner */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none rounded-full" />

                    <div className="p-6 sm:p-8 lg:px-12 lg:pt-10 flex-shrink-0 border-b border-border pb-6 bg-obsidian-surface/30">
                        <input
                            type="text"
                            value={activeNote.title}
                            onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                            className="mb-2 w-full bg-transparent border-none text-2xl font-display font-black text-text-primary placeholder:text-text-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:text-3xl"
                            placeholder="Note Title"
                        />
                        <div className="flex items-center gap-4 text-xs font-bold text-text-secondary/60 uppercase tracking-widest">
                            <span>Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activeNote.updatedAt))}</span>
                            <span>•</span>
                            <span className="tabular-nums">{wordCount} words</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto lg:px-12 px-6 sm:px-8 py-8 relative group">
                        {/* Rich text feel lines background mock */}
                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, rgba(255,255,255,0.03) 31px, rgba(255,255,255,0.03) 32px)", backgroundPosition: "0 8px" }} />

                        <textarea
                            className="custom-scrollbar relative z-10 h-full w-full resize-none border-none bg-transparent text-[15px] font-serif leading-8 text-text-primary drop-shadow-sm placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:text-base"
                            value={activeNote.content}
                            onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your notes here... (Use -, *, or 1. to trigger smart lists)"
                        />
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center surface rounded-2xl border-border border-dashed border shadow-lg m-2 lg:m-0">
                    <p className="text-text-secondary font-display text-lg">Select or create a note to begin.</p>
                </div>
            )}
        </div>
    );
}

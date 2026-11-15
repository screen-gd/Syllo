"use client";

import { useState } from "react";
import SlidingHighlight from "@/components/syllo/SlidingHighlight";
import type { NoteSection, Section, Note } from "@/types";
import { Add, Icon } from "@/components/glaze/icon";
import { Button } from "@/components/glaze/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/glaze/ui/empty-state";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemLink,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { Input } from "@/components/glaze/ui/input";
import { Textarea } from "@/components/glaze/ui/textarea";

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
        <div className="flex min-h-0 flex-col gap-4 lg:h-full lg:flex-row">

            {/* Sidebar List */}
            <div className="shell w-full shrink-0 lg:w-72">
                <div className="panel flex min-h-0 flex-col">
                    <div className="flex items-center justify-between border-b border-line-faint p-3">
                        <h2 className="type-heading-sm">Notes</h2>
                        <Button
                            variant="secondary"
                            size="icon-sm"
                            aria-label="Create new note"
                            onClick={addNote}
                        >
                            <Icon icon={Add} />
                        </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {section.data.length > 0 ? (
                            <ItemGroup variant="plain" aria-label="Notes">
                                {section.data.map((note) => (
                                    <Item
                                        key={note.id}
                                        data-highlight-host=""
                                    >
{(note.id === activeNoteId) && <SlidingHighlight group="workspace-notes" shape="tag" />}
                                        <ItemContent>
                                            <ItemTitle>
                                                <ItemLink
                                                    href={`#note-${note.id}`}
                                                    aria-current={note.id === activeNoteId ? "true" : undefined}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setActiveNoteId(note.id);
                                                    }}
                                                >
                                                    {note.title || "Untitled note"}
                                                </ItemLink>
                                            </ItemTitle>
                                            <ItemDescription>
                                                {new Intl.DateTimeFormat("en-US", { dateStyle: "short" }).format(new Date(note.updatedAt))}
                                            </ItemDescription>
                                        </ItemContent>
                                    </Item>
                                ))}
                            </ItemGroup>
                        ) : (
                            <p className="p-3 type-caption text-text-2">
                                No notes yet. Create one to begin.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Editor Main */}
            {activeNote ? (
                <div className="shell min-h-0 flex-1">
                    <div className="panel flex min-h-0 flex-1 flex-col">
                        <div className="border-b border-line-faint p-3">
                            <Input
                                value={activeNote.title}
                                onValueChange={(value) => updateNote(activeNote.id, { title: value })}
                                aria-label="Note title"
                                placeholder="Note title"
                            />
                            <p className="mt-1 type-caption text-text-2">
                                Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activeNote.updatedAt))}{" "}
                                · {wordCount} words
                            </p>
                        </div>
                        <div className="flex-1 p-3">
                        <Textarea
                            autoGrow
                            minRows={12}
                            maxRows={40}
                            value={activeNote.content}
                            onValueChange={(value) =>
                                updateNote(activeNote.id, { content: value })
                            }
                            onKeyDown={handleKeyDown}
                            placeholder="Type your notes here... (Use -, *, or 1. to trigger smart lists)"
                            aria-label="Note content"
                        />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1">
                    <Empty className="h-full">
                        <EmptyHeader>
                            <EmptyTitle>Select or create a note</EmptyTitle>
                            <EmptyDescription>
                                Pick a note on the left or create a new one to
                                begin.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </div>
            )}
        </div>
    );
}

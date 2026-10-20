"use client";

import { useState, useMemo } from "react";
import type { GlossarySection, Section } from "@/types";

interface Props {
    section: GlossarySection;
    onUpdate: (updater: (s: Section) => Section) => void;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function GlossarySection({ section, onUpdate }: Props) {
    const [activeLetter, setActiveLetter] = useState<string | null>(null);
    const [expandedTermId, setExpandedTermId] = useState<string | null>(null);

    // Group terms by first letter
    const groupedTerms = useMemo(() => {
        const sorted = [...section.data].sort((a, b) => a.term.localeCompare(b.term));
        const groups: Record<string, typeof sorted> = {};

        sorted.forEach((item) => {
            const letter = item.term.charAt(0).toUpperCase();
            if (!groups[letter]) groups[letter] = [];
            groups[letter].push(item);
        });

        return groups;
    }, [section.data]);

    const toggleExpand = (id: string) => {
        setExpandedTermId(prev => prev === id ? null : id);
    };

    const visibleLetters = Object.keys(groupedTerms);
    const lettersToShow = activeLetter ? [activeLetter] : visibleLetters.sort();

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="text-center sm:text-left">
                <h2 className="font-display text-3xl font-black text-text-primary mb-2 drop-shadow-md">
                    📖 {section.title}
                </h2>
                <p className="text-text-secondary text-sm">Key definitions and terminology.</p>
            </div>

            {/* A-Z Filter Bar */}
            <div className="surface rounded-2xl p-4 sm:p-5 flex flex-wrap gap-2 sm:gap-3 justify-center border border-border shadow-lg bg-obsidian-surface/80 backdrop-blur-md sticky top-20 z-10 transition-all duration-300">
                <button
                    onClick={() => setActiveLetter(null)}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold transition-all ${activeLetter === null
                            ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                            : "text-text-secondary hover:bg-obsidian hover:text-text-primary"
                        }`}
                >
                    All
                </button>
                <div className="w-px h-8 bg-white/10 mx-1" />
                {ALPHABET.map((letter) => {
                    const hasTerms = visibleLetters.includes(letter);
                    return (
                        <button
                            key={letter}
                            disabled={!hasTerms}
                            onClick={() => setActiveLetter(letter)}
                            className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold transition-all ${activeLetter === letter
                                    ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                                    : hasTerms
                                        ? "text-text-secondary hover:bg-obsidian hover:text-text-primary"
                                        : "text-text-secondary/20 cursor-not-allowed"
                                }`}
                        >
                            {letter}
                        </button>
                    );
                })}
            </div>

            <div className="space-y-10 px-2 sm:px-0">
                {lettersToShow.map((letter, i) => (
                    <div key={letter} className="animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                        <div className="flex items-center gap-4 mb-4">
                            <h3 className="font-display text-2xl font-black text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.5)] w-8 text-center">{letter}</h3>
                            <div className="h-px bg-gradient-to-r from-indigo-500/30 to-transparent flex-1" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {groupedTerms[letter].map((item) => {
                                const isExpanded = expandedTermId === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        className={`surface rounded-2xl overflow-hidden border transition-all duration-300 ${isExpanded
                                                ? 'border-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.1)] bg-obsidian-elevated/80 ring-1 ring-indigo-500/20'
                                                : 'border-border hover:border-border-subtle hover:bg-obsidian-hover'
                                            }`}
                                    >
                                        <button
                                            type="button"
                                            className="w-full text-left p-5 flex items-start justify-between gap-4 outline-none group"
                                            onClick={() => toggleExpand(item.id)}
                                        >
                                            <span className={`font-bold text-base transition-colors duration-300 ${isExpanded ? 'text-indigo-300' : 'text-text-primary group-hover:text-indigo-200'}`}>
                                                {item.term}
                                            </span>
                                            <span className={`text-text-secondary text-xs shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-black/20 transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180 bg-indigo-500/20 text-indigo-300' : ''}`}>
                                                ▼
                                            </span>
                                        </button>

                                        {/* Smooth Accordion Body */}
                                        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                                            <div className="overflow-hidden">
                                                <div className="p-5 pt-0 text-sm text-text-secondary leading-relaxed border-t border-border bg-gradient-to-b from-transparent to-black/10">
                                                    {item.definition}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

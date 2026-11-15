"use client";

import { useState, useMemo } from "react";
import type { GlossarySection, Section } from "@/types";
import { ChevronDown, Icon } from "@/components/glaze/icon";
import { Button } from "@/components/glaze/ui/button";
import { cn } from "@/lib/glaze/utils";

interface Props {
    section: GlossarySection;
    onUpdate: (updater: (s: Section) => Section) => void;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function GlossarySection({ section }: Props) {
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
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="type-heading">{section.title}</h2>
                <p className="mt-1 type-body-sm text-text-2">Key definitions and terminology.</p>
            </div>

            {/* A-Z Filter Bar */}
            <div className="sticky top-4 z-(--z-sticky) flex flex-wrap gap-1 rounded-panel border border-line-faint bg-paper p-2">
                <Button
                    variant={activeLetter === null ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveLetter(null)}
                >
                    All
                </Button>
                {ALPHABET.map((letter) => {
                    const hasTerms = visibleLetters.includes(letter);
                    return (
                        <Button
                            key={letter}
                            variant={activeLetter === letter ? "secondary" : "ghost"}
                            size="sm"
                            disabled={!hasTerms}
                            onClick={() => setActiveLetter(letter)}
                        >
                            {letter}
                        </Button>
                    );
                })}
            </div>

            <div className="flex flex-col gap-8">
                {lettersToShow.map((letter) => (
                    <div key={letter}>
                        <h3 className="type-heading-sm">{letter}</h3>

                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {groupedTerms[letter].map((item) => {
                                const isExpanded = expandedTermId === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "rounded-panel border border-line-faint bg-paper",
                                            isExpanded && "bg-pressed",
                                        )}
                                    >
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-between"
                                            aria-expanded={isExpanded}
                                            onClick={() => toggleExpand(item.id)}
                                        >
                                            <span className="type-body-sm">
                                                {item.term}
                                            </span>
                                            <Icon
                                                icon={ChevronDown}
                                                className={cn(
                                                    "text-text-3 transition-transform duration-(--dur-state) ease-out",
                                                    isExpanded && "rotate-180",
                                                )}
                                            />
                                        </Button>
                                        {isExpanded ? (
                                            <div className="border-t border-line-faint p-3 type-body-sm text-text-2">
                                                {item.definition}
                                            </div>
                                        ) : null}
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

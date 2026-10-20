"use client";

import type { CalendarSection as CalendarSectionType, Section, CalendarEvent } from "@/types";
import EmptyState from "@/components/shared/EmptyState";

interface Props {
    section: CalendarSectionType;
    onUpdate: (updater: (s: Section) => Section) => void;
}

export default function CalendarSection({ section, onUpdate }: Props) {
    const toggleEvent = (eventId: string) => {
        onUpdate((s) => {
            const cs = s as CalendarSectionType;
            return {
                ...cs,
                data: cs.data.map((e: CalendarEvent) =>
                    e.id === eventId ? { ...e, completed: !e.completed } : e
                ),
            };
        });
    };

    const sorted = [...section.data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (sorted.length === 0) {
        return <EmptyState icon="📅" title="No events" description="Calendar events mentioned in your roadmap will appear here as a timeline." />;
    }

    return (
        <div className="max-w-3xl">
            <h2 className="font-display text-2xl font-bold text-text-primary text-text-primary mb-6 animate-fade-in">
                📅 {section.title}
            </h2>

            <div className="space-y-3">
                {sorted.map((event, i) => (
                    <div
                        key={event.id}
                        className="surface rounded-xl p-4 card-hover animate-slide-up content-auto"
                        style={{ animationDelay: `${i * 0.05}s` }}
                    >
                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={event.completed}
                                onChange={() => toggleEvent(event.id)}
                                className="w-4 h-4 rounded accent-indigo-accent mt-0.5 shrink-0"
                                aria-label={`Mark "${event.title}" as done`}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className={`font-display font-bold text-sm ${event.completed ? "text-text-secondary line-through" : "text-text-primary"
                                        }`}>
                                        {event.title}
                                    </h3>
                                </div>
                                <p className="text-text-secondary text-sm">{event.description}</p>
                                <p className="text-text-secondary text-sm mt-1 tabular-nums">
                                    {new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(event.date))}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

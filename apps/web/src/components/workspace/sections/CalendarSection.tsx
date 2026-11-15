"use client";

import type { CalendarSection as CalendarSectionType, Section, CalendarEvent } from "@/types";
import { Calendar } from "@/components/glaze/icon";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { Switch } from "@/components/glaze/ui/switch";
import { cn } from "@/lib/glaze/utils";

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
        return (
            <Empty className="w-full max-w-md">
                <EmptyHeader>
                    <EmptyTitle icon={Calendar}>No events</EmptyTitle>
                    <EmptyDescription>
                        Calendar events mentioned in your roadmap will appear
                        here as a timeline.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div>
            <h2 className="type-heading">{section.title}</h2>

            <div className="shell mt-4">
            <ul className="panel flex flex-col">
                {sorted.map((event) => (
                    <li
                        key={event.id}
                        className="rule-row flex items-start gap-3 p-3"
                    >
                        <Switch
                            className="mt-0.5"
                            aria-label={`Mark "${event.title}" as done`}
                            checked={event.completed}
                            onCheckedChange={() => toggleEvent(event.id)}
                        />
                        <div className="min-w-0 flex-1">
                            <h3
                                className={cn(
                                    "type-label",
                                    event.completed &&
                                        "text-text-2 line-through",
                                )}
                            >
                                {event.title}
                            </h3>
                            <p className="type-body-sm text-text-2">
                                {event.description}
                            </p>
                            <p className="mt-1 type-caption text-text-2">
                                {new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(event.date))}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
            </div>
        </div>
    );
}

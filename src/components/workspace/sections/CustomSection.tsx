"use client";

import type { CustomSection as CustomSectionType, Section, CustomItem } from "@/types";
import EmptyState from "@/components/shared/EmptyState";

interface Props {
    section: CustomSectionType;
    onUpdate: (updater: (s: Section) => Section) => void;
}

export default function CustomSection({ section, onUpdate }: Props) {
    const { data } = section;

    const toggleItem = (itemId: string) => {
        onUpdate((s) => {
            const cs = s as CustomSectionType;
            return {
                ...cs,
                data: {
                    ...cs.data,
                    items: cs.data.items.map((item: CustomItem) =>
                        item.id === itemId ? { ...item, completed: !item.completed } : item
                    ),
                },
            };
        });
    };

    if (data.items.length === 0) {
        return <EmptyState icon="🔧" title={section.title} description={data.description || "Custom section content will appear here."} />;
    }

    // Render based on layout
    if (data.layout === "checklist") {
        return (
            <div className="max-w-3xl">
                <h2 className="font-display text-2xl font-bold text-text-primary text-text-primary mb-2 animate-fade-in">
                    🔧 {section.title}
                </h2>
                {data.description ? <p className="text-text-secondary text-sm mb-6">{data.description}</p> : null}
                <div className="surface rounded-xl divide-y divide-border overflow-hidden">
                    {data.items.map((item) => (
                        <label key={item.id} className="flex items-center gap-3 p-3.5 hover:bg-obsidian-hover cursor-pointer content-auto">
                            <input
                                type="checkbox"
                                checked={item.completed || false}
                                onChange={() => toggleItem(item.id)}
                                className="w-4 h-4 rounded accent-indigo-accent"
                            />
                            <div className="min-w-0 flex-1">
                                <span className={`text-sm ${item.completed ? "text-text-secondary line-through" : "text-text-primary"}`}>
                                    {item.title}
                                </span>
                                {item.description ? (
                                    <p className="text-text-secondary text-sm mt-0.5">{item.description}</p>
                                ) : null}
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        );
    }

    if (data.layout === "cards") {
        return (
            <div className="max-w-4xl">
                <h2 className="font-display text-2xl font-bold text-text-primary text-text-primary mb-2 animate-fade-in">
                    🔧 {section.title}
                </h2>
                {data.description ? <p className="text-text-secondary text-sm mb-6">{data.description}</p> : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.items.map((item, i) => (
                        <div
                            key={item.id}
                            className="surface rounded-xl p-4 card-hover animate-slide-up"
                            style={{ animationDelay: `${i * 0.03}s` }}
                        >
                            <h4 className="font-display font-semibold text-base text-text-primary text-text-primary mb-1">{item.title}</h4>
                            {item.description ? <p className="text-text-secondary text-sm">{item.description}</p> : null}
                            {item.metadata ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {Object.entries(item.metadata).map(([k, v]) => (
                                        <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-obsidian-elevated text-text-secondary">
                                            {k}: {v}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Default: list layout
    return (
        <div className="max-w-3xl">
            <h2 className="font-display text-2xl font-bold text-text-primary text-text-primary mb-2 animate-fade-in">
                🔧 {section.title}
            </h2>
            {data.description ? <p className="text-text-secondary text-sm mb-6">{data.description}</p> : null}
            <div className="space-y-2">
                {data.items.map((item, i) => (
                    <div
                        key={item.id}
                        className="surface rounded-lg p-4 animate-slide-up content-auto"
                        style={{ animationDelay: `${i * 0.03}s` }}
                    >
                        <h4 className="font-display font-semibold text-base text-text-primary text-text-primary">{item.title}</h4>
                        {item.description ? <p className="text-text-secondary text-sm mt-1">{item.description}</p> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

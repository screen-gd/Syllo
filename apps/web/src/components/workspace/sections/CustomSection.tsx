"use client";

import type { CustomSection as CustomSectionType, Section, CustomItem } from "@/types";
import { Badge } from "@/components/glaze/ui/badge";
import { Checkbox } from "@/components/glaze/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/glaze/ui/empty-state";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { cn } from "@/lib/glaze/utils";

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
        return (
            <Empty reason="empty">
                <EmptyHeader>
                    <EmptyTitle>{section.title}</EmptyTitle>
                    <EmptyDescription>
                        {data.description || "Custom section content will appear here."}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const header = (
        <div>
            <h2 className="type-heading">{section.title}</h2>
            {data.description ? (
                <p className="mt-1 type-body-sm text-text-2">{data.description}</p>
            ) : null}
        </div>
    );

    // Render based on layout
    if (data.layout === "checklist") {
        return (
            <div className="flex flex-col gap-6">
                {header}
                <div className="shell">
                    <ul className="panel flex flex-col">
                        {data.items.map((item) => (
                            <li key={item.id} className="rule-row">
                                <label className="flex cursor-pointer items-start gap-3 p-3">
                                    <Checkbox
                                        className="mt-0.5"
                                        checked={item.completed || false}
                                        onCheckedChange={() => toggleItem(item.id)}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className={cn(
                                                "type-body-sm",
                                                item.completed ? "text-text-2 line-through" : "text-text-1",
                                            )}
                                        >
                                            {item.title}
                                        </span>
                                        {item.description ? (
                                            <span className="mt-0.5 block type-body-sm text-text-2">
                                                {item.description}
                                            </span>
                                        ) : null}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }

    if (data.layout === "cards") {
        return (
            <div className="flex flex-col gap-6">
                {header}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.items.map((item) => (
                        <div key={item.id} className="shell">
                            <div className="panel h-full p-3">
                                <h4 className="type-heading-sm">{item.title}</h4>
                                {item.description ? (
                                    <p className="mt-1 type-body-sm text-text-2">{item.description}</p>
                                ) : null}
                                {item.metadata ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {Object.entries(item.metadata).map(([k, v]) => (
                                            <Badge key={k}>
                                                {k}: {v}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Default: list layout
    return (
        <div className="flex flex-col gap-6">
            {header}
            <div className="shell">
                <ItemGroup className="panel">
                    {data.items.map((item) => (
                        <Item key={item.id}>
                            <ItemContent>
                                <ItemTitle>{item.title}</ItemTitle>
                                {item.description ? (
                                    <ItemDescription>{item.description}</ItemDescription>
                                ) : null}
                            </ItemContent>
                        </Item>
                    ))}
                </ItemGroup>
            </div>
        </div>
    );
}

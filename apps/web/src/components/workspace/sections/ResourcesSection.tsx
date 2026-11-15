"use client";

import { useState } from "react";
import type { ResourceSection, Section, Resource } from "@/types";
import ContentViewer from "@/components/shared/ContentViewer";
import { Badge } from "@/components/glaze/ui/badge";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemLink,
    ItemMedia,
    ItemTitle,
} from "@/components/glaze/ui/item";
import {
    Attachment,
    BookOpen,
    Code,
    Document,
    FileVideo,
    Icon,
    Library,
    Link as LinkIcon,
    Tool,
    Trophy,
} from "@/components/glaze/icon";

interface Props {
    section: ResourceSection;
    onUpdate: (updater: (s: Section) => Section) => void;
}

const TYPE_ICONS: Record<string, typeof Document> = {
    doc: Document,
    video: FileVideo,
    tool: Tool,
    course: Trophy,
    book: Library,
    pdf: BookOpen,
    code: Code,
    link: LinkIcon,
};

export default function Resources({ section }: Props) {
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);

    const categories = Array.from(new Set(section.data.map((r: Resource) => r.category || "Uncategorized"))).sort();

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h2 className="type-heading">{section.title}</h2>
                <p className="mt-1 type-body-sm text-text-2">Curated materials to accelerate your learning.</p>
            </div>

            {categories.map((category) => {
                const catResources = section.data.filter((r: Resource) => (r.category || "Uncategorized") === category);
                return (
                    <div key={category}>
                        <div className="mb-3 flex items-center gap-3">
                            <h3 className="type-heading-sm">{category}</h3>
                            <Badge>{catResources.length} items</Badge>
                        </div>
                        <ItemGroup>
                            {catResources.map((res: Resource) => (
                                <Item key={res.id}>
                                    <ItemMedia variant="icon">
                                        <Icon icon={TYPE_ICONS[res.type] ?? Attachment} />
                                    </ItemMedia>
                                    <ItemContent>
                                        <ItemTitle>
                                            <ItemLink
                                                href={res.url}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setViewerUrl(res.url);
                                                }}
                                            >
                                                {res.title}
                                            </ItemLink>
                                        </ItemTitle>
                                        {res.description ? (
                                            <ItemDescription>
                                                {res.description}
                                            </ItemDescription>
                                        ) : null}
                                    </ItemContent>
                                    <Badge>{res.type}</Badge>
                                </Item>
                            ))}
                        </ItemGroup>
                    </div>
                );
            })}

            <ContentViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
        </div>
    );
}

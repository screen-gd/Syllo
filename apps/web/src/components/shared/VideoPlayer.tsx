"use client";

import { External, Icon } from "@/components/glaze/icon";
import { Button } from "@/components/glaze/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/glaze/ui/empty-state";
import { getEmbedUrl, detectPlatform } from "@/lib/video-utils";

interface VideoPlayerProps {
    url: string;
    title?: string;
    description?: string;
}

export default function VideoPlayer({ url, title, description }: VideoPlayerProps) {
    const embedUrl = getEmbedUrl(url);
    const platform = detectPlatform(url);

    if (!embedUrl) {
        return (
            <Empty variant="plain">
                <EmptyHeader>
                    <EmptyTitle>Unable to embed this video</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                    <Button
                        variant="secondary"
                        size="sm"
                        nativeButton={false}
                        render={<a href={url} target="_blank" rel="noopener noreferrer" />}
                    >
                        Open externally
                        <Icon icon={External} />
                    </Button>
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="relative aspect-16/9 w-full overflow-hidden rounded-panel bg-field">
                <iframe
                    src={embedUrl}
                    title={title || "Video player"}
                    className="absolute inset-0 size-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                />
            </div>
            {(title || description) ? (
                <div className="px-1">
                    {title ? <h4 className="type-label">{title}</h4> : null}
                    {description ? (
                        <p className="mt-0.5 line-clamp-2 type-body-sm text-text-2">{description}</p>
                    ) : null}
                    <span className="type-caption capitalize text-text-2">{platform}</span>
                </div>
            ) : null}
        </div>
    );
}

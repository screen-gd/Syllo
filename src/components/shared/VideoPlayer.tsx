"use client";

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
            <div className="surface rounded-lg p-4 text-center">
                <p className="text-text-secondary text-sm">Unable to embed this video</p>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-accent text-sm hover:underline mt-1 inline-block"
                >
                    Open externally ↗
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-obsidian-surface">
                <iframe
                    src={embedUrl}
                    title={title || "Video player"}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                />
            </div>
            {(title || description) ? (
                <div className="px-1">
                    {title ? (
                        <h4 className="font-display font-semibold text-base text-text-primary text-text-primary">{title}</h4>
                    ) : null}
                    {description ? (
                        <p className="text-text-secondary text-sm mt-0.5 line-clamp-2">{description}</p>
                    ) : null}
                    <span className="text-text-secondary text-[12px] capitalize">{platform}</span>
                </div>
            ) : null}
        </div>
    );
}

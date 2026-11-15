"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/glaze/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/glaze/ui/item";
import { Skeleton } from "@/components/glaze/ui/skeleton";

interface SmartEmbedProps {
    url: string;
    title: string;
    description?: string;
}

function getEmbedUrl(url: string): string | null {
    try {
        const u = new URL(url);
        // YouTube
        if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
            const videoId = u.hostname.includes("youtu.be")
                ? u.pathname.slice(1)
                : u.searchParams.get("v");
            if (videoId) return `https://www.youtube.com/embed/${videoId}`;
        }
        // Vimeo
        if (u.hostname.includes("vimeo.com")) {
            const match = u.pathname.match(/\/(\d+)/);
            if (match) return `https://player.vimeo.com/video/${match[1]}`;
        }
        // Google Docs / Sheets / Slides
        if (u.hostname.includes("docs.google.com")) {
            if (url.includes("/edit")) return url.replace("/edit", "/preview");
            if (url.includes("/pub")) return url;
            return url;
        }
    } catch {
        // invalid URL
    }
    return null;
}

function getFaviconUrl(url: string): string {
    try {
        const u = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
    } catch {
        return "";
    }
}

function getDomain(url: string): string {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return url;
    }
}

export default function SmartEmbed({ url, title, description }: SmartEmbedProps) {
    const [iframeBlocked, setIframeBlocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

    // Check if this is a known embeddable URL
    const embedUrl = getEmbedUrl(url);
    const isKnownEmbed = embedUrl !== null;

    useEffect(() => {
        if (isKnownEmbed) return;

        // For unknown URLs, show a fallback if the iframe does not load quickly.
        timeoutRef.current = setTimeout(() => {
            if (loading) {
                setIframeBlocked(true);
                setLoading(false);
            }
        }, 4000);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [isKnownEmbed, loading]);

    const handleIframeLoad = () => {
        setLoading(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const handleIframeError = () => {
        setIframeBlocked(true);
        setLoading(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    // Known embeds: always render iframe
    if (isKnownEmbed) {
        return (
            <div className="aspect-16/9 w-full overflow-hidden rounded-panel bg-field">
                <iframe
                    src={embedUrl}
                    title={title}
                    className="size-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        );
    }

    // Blocked or unknown: show fallback card
    if (iframeBlocked) {
        return (
            <div className="overflow-hidden rounded-panel border border-line-faint">
            <Item>
                <ItemMedia variant="image">
                    {/* next/image is not practical here because favicon domains are fully dynamic. */}
                    <img
                        src={getFaviconUrl(url)}
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).hidden = true; }}
                    />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle>{title}</ItemTitle>
                    <ItemDescription>{description || getDomain(url)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                    <Button
                        variant="secondary"
                        size="sm"
                        nativeButton={false}
                        render={<a href={url} target="_blank" rel="noopener noreferrer" />}
                    >
                        Open resource
                    </Button>
                </ItemActions>
            </Item>
            </div>
        );
    }

    // Attempting iframe load
    return (
        <div className="relative w-full">
            {loading && (
                <Skeleton className="absolute inset-0 z-(--z-raised) rounded-panel" aria-label="Loading resource" />
            )}
            <iframe
                ref={iframeRef}
                src={url}
                title={title}
                className="h-125 w-full rounded-panel border border-line-faint"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-scripts allow-same-origin allow-popups"
            />
        </div>
    );
}

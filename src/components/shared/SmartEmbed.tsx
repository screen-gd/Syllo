"use client";

import { useState, useRef, useEffect } from "react";

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
            <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-border">
                <iframe
                    src={embedUrl}
                    title={title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        );
    }

    // Blocked or unknown: show fallback card
    if (iframeBlocked) {
        return (
            <div className="w-full border border-border-subtle bg-obsidian-elevated/60 p-6 flex items-center gap-5 transition-all hover:border-indigo-500/30 hover:bg-obsidian-elevated/80 group">
                {/* next/image is not practical here because favicon domains are fully dynamic. */}
                <img
                    src={getFaviconUrl(url)}
                    alt=""
                    className="w-10 h-10 rounded-lg bg-white/5 p-1 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="flex-1 min-w-0">
                    <h4 className="font-sans-display text-sm font-bold text-text-primary truncate">{title}</h4>
                    {description && (
                        <p className="text-text-secondary text-sm mt-0.5 line-clamp-2">{description}</p>
                    )}
                    <p className="text-text-secondary/50 text-sm uppercase tracking-widest mt-1">{getDomain(url)}</p>
                </div>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-sans-display text-xs uppercase tracking-widest text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-500 px-4 py-2.5 transition-all bg-indigo-500/5 hover:bg-indigo-500 whitespace-nowrap"
                >
                    Open Resource
                </a>
            </div>
        );
    }

    // Attempting iframe load
    return (
        <div className="w-full relative">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-obsidian-elevated/80 z-10 border border-border">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-text-secondary text-[12px]">Loading resource...</span>
                    </div>
                </div>
            )}
            <iframe
                ref={iframeRef}
                src={url}
                title={title}
                className="w-full h-[500px] border border-border rounded-lg"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-scripts allow-same-origin allow-popups"
            />
        </div>
    );
}

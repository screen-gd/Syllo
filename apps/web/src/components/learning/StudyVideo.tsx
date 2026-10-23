/// <reference types="youtube" />
import { useEffect, useRef, useState } from "react";
import { detectPlatform, getEmbedUrl, getYouTubeId } from "@/lib/video-utils";
import { safeResourceUrl } from "@/lib/learning";

declare global {
    interface Window {
        onYouTubeIframeAPIReady?: () => void;
    }
}
let youtubeReady: Promise<void> | null = null;
function loadYouTube() {
    if (typeof YT !== "undefined" && YT.Player) return Promise.resolve();
    youtubeReady ??= new Promise<void>((resolve, reject) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve();
        };
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = () => {
            youtubeReady = null;
            reject(
                new Error(
                    "The video player could not load. Check your connection.",
                ),
            );
        };
        document.head.append(script);
    });
    return youtubeReady;
}

export default function StudyVideo({
    url,
    title,
    startSeconds,
    seekTo,
    onPosition,
}: {
    url: string;
    title: string;
    startSeconds: number;
    seekTo: number | null;
    onPosition: (seconds: number) => void;
}) {
    const mount = useRef<HTMLDivElement>(null);
    const player = useRef<YT.Player | null>(null);
    const positionCallback = useRef(onPosition);
    positionCallback.current = onPosition;
    const start = useRef(startSeconds);
    start.current = startSeconds;
    const seekRef = useRef(seekTo);
    seekRef.current = seekTo;
    const [error, setError] = useState<string | null>(null);
    const youtubeId = getYouTubeId(url);
    useEffect(() => {
        if (!youtubeId || !mount.current) return;
        let disposed = false;
        let interval: ReturnType<typeof setInterval> | undefined;
        let hasPlayed = false;
        const target = document.createElement("div");
        mount.current.replaceChildren(target);
        function savePosition() {
            if (!hasPlayed) return;
            const seconds = player.current?.getCurrentTime?.();
            if (typeof seconds === "number" && Number.isFinite(seconds))
                positionCallback.current(Math.max(0, seconds));
        }
        void loadYouTube()
            .then(() => {
                if (disposed) return;
                player.current = new YT.Player(target, {
                    videoId: youtubeId,
                    playerVars: {
                        start: Math.floor(start.current),
                        origin: location.origin,
                        rel: 0,
                        playsinline: 1,
                    },
                    events: {
                        onReady: (event) => {
                            const iframe = event.target.getIframe();
                            iframe.title = title;
                            if (seekRef.current !== null)
                                event.target.seekTo(seekRef.current, true);
                            interval = setInterval(savePosition, 5000);
                        },
                        onStateChange: (event) => {
                            if (event.data === YT.PlayerState.PLAYING)
                                hasPlayed = true;
                            savePosition();
                        },
                        onError: () =>
                            setError(
                                "This video cannot be embedded. Open its source to watch it.",
                            ),
                    },
                });
            })
            .catch((cause) => {
                if (!disposed)
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : "Could not load the video.",
                    );
            });
        window.addEventListener("pagehide", savePosition);
        return () => {
            disposed = true;
            if (interval) clearInterval(interval);
            savePosition();
            window.removeEventListener("pagehide", savePosition);
            player.current?.destroy();
            player.current = null;
        };
    }, [youtubeId, title]);
    useEffect(() => {
        if (seekTo !== null) player.current?.seekTo?.(seekTo, true);
    }, [seekTo]);
    const embed = getEmbedUrl(url);
    const external = safeResourceUrl(url);
    return (
        <>
            {error && (
                <p className="sy-error" role="alert">
                    {error}
                </p>
            )}
            {youtubeId ? (
                <div className="sy-embed">
                    <div ref={mount} />
                </div>
            ) : embed && detectPlatform(url) === "vimeo" ? (
                <div className="sy-embed">
                    <iframe
                        title={title}
                        src={`${embed}#t=${Math.floor(startSeconds)}s`}
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            ) : (
                <div className="sy-empty bordered">
                    This source opens in its own player.
                    {external && (
                        <p>
                            <a
                                href={external}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open source ↗
                            </a>
                        </p>
                    )}
                </div>
            )}
        </>
    );
}

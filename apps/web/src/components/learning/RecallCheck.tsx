import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon, Play } from "@/components/glaze/icon";
import { Button } from "@/components/glaze/ui/button";
import { Textarea } from "@/components/glaze/ui/textarea";
import { scoutApi } from "@/lib/scout/api-client";
import { formatTimestamp } from "@/lib/scout/format";
import type { VideoChapterInput, VideoCheck } from "@/lib/scout/types";
import { getActiveApiKey, getActiveModel, getUserConfig } from "@/lib/userConfig";
import { getYouTubeId } from "@/lib/video-utils";

export type VideoChecksState =
    | { kind: "off" }
    | { kind: "loading" }
    | { kind: "ready"; checks: VideoCheck[] }
    | { kind: "no_transcript" }
    | { kind: "no_key" }
    | { kind: "error"; message: string };

/**
 * Loads the recall questions for a YouTube video. The server caches them, so
 * only the first visit to a video reads its transcript and calls Gemini.
 */
export function useVideoChecks(input: {
    url: string | null;
    title: string;
    chapters: VideoChapterInput[];
    durationSeconds: number | null;
}): { state: VideoChecksState; retry: () => void } {
    const [state, setState] = useState<VideoChecksState>({ kind: "off" });
    const [attempt, setAttempt] = useState(0);
    const youtubeId = input.url ? getYouTubeId(input.url) : null;
    const chapterKey = input.chapters.map((chapter) => `${chapter.seconds}:${chapter.label}`).join("|");
    const latest = useRef(input);
    latest.current = input;

    useEffect(() => {
        const { url, title, chapters, durationSeconds } = latest.current;
        if (!youtubeId || !url) {
            setState({ kind: "off" });
            return;
        }
        let cancelled = false;
        setState({ kind: "loading" });
        const config = getUserConfig();
        void scoutApi
            .videoChecks({
                url,
                title,
                chapters,
                durationSeconds,
                provider: config.provider,
                model: getActiveModel(config),
                apiKey: config.useCustomKey ? getActiveApiKey(config) : undefined,
            })
            .then((result) => {
                if (cancelled) return;
                setState(result.status === "ready" ? { kind: "ready", checks: result.checks } : { kind: "no_transcript" });
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                const message = error instanceof Error ? error.message : "Could not load questions.";
                setState(/gemini api key/i.test(message) ? { kind: "no_key" } : { kind: "error", message });
            });
        return () => {
            cancelled = true;
        };
    }, [youtubeId, chapterKey, attempt]);

    return { state, retry: () => setAttempt((value) => value + 1) };
}

/**
 * One recall question: answer from memory, then see the transcript lines that
 * answer it. Nothing is graded; comparing is the learner's job.
 */
export function RecallPrompt({
    check,
    eyebrow,
    autoFocus = false,
    onReplay,
    onDone,
    doneLabel,
    onSkip,
}: {
    check: VideoCheck;
    eyebrow: string;
    autoFocus?: boolean;
    onReplay: (seconds: number) => void;
    onDone: (answer: string) => void;
    doneLabel: string;
    onSkip?: () => void;
}) {
    const [answer, setAnswer] = useState("");
    const [revealed, setRevealed] = useState(false);
    const answerId = useId();
    const revealRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setAnswer("");
        setRevealed(false);
    }, [check.id]);

    useEffect(() => {
        if (revealed) revealRef.current?.focus();
    }, [revealed]);

    return (
        <div className="well rounded-panel p-3">
            <p className="type-heading-sm" id={`${answerId}-question`}>
                {check.question}
            </p>
            <p className="mt-1 type-caption text-text-2">{eyebrow}</p>
            {!revealed ? (
                <>
                    <div className="mt-3">
                        <Textarea
                            value={answer}
                            onValueChange={setAnswer}
                            autoFocus={autoFocus}
                            placeholder="Answer from memory, in a sentence or two."
                            aria-labelledby={`${answerId}-question`}
                            limit={600}
                            autoGrow
                            minRows={2}
                            maxRows={6}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) setRevealed(true);
                            }}
                        />
                    </div>
                    <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => setRevealed(true)}>
                            {answer.trim() ? "Check my answer" : "I don't know, show me"}
                        </Button>
                        {onSkip && (
                            <Button size="sm" variant="ghost" onClick={onSkip}>
                                Skip
                            </Button>
                        )}
                    </div>
                </>
            ) : (
                <div ref={revealRef} tabIndex={-1}>
                    {answer.trim() && (
                        <div className="mt-3">
                            <span className="type-caption text-text-2">You said</span>
                            <p className="type-body-sm">{answer.trim()}</p>
                        </div>
                    )}
                    <div className="mt-3">
                        <span className="type-caption text-text-2">
                            From the video at {formatTimestamp(check.sourceStart)}
                        </span>
                        <blockquote className="mt-1 flex flex-col gap-1 ps-4 type-body-sm text-text-2">
                            {check.sourceLines.map((line, index) => (
                                <p key={index}>{line}</p>
                            ))}
                        </blockquote>
                        <p className="mt-2 type-body-sm">
                            <span className="text-text-1">In short:</span> {check.answer}
                        </p>
                    </div>
                    <p className="mt-3 type-caption text-text-2">Compare for yourself. If you missed it, replay that moment.</p>
                    <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => onDone(answer.trim())}>
                            {doneLabel}
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onReplay(check.sourceStart)}
                        >
                            <Icon icon={Play} />
                            Replay {formatTimestamp(check.sourceStart)}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Status line for the Check tab when there are no questions to show. */
export function VideoChecksStatus({ state, onRetry }: { state: VideoChecksState; onRetry: () => void }) {
    switch (state.kind) {
        case "off":
        case "ready":
            return null;
        case "loading":
            return <p className="type-body-sm text-text-2">Writing questions from the video&apos;s transcript…</p>;
        case "no_transcript":
            return (
                <p className="type-body-sm text-text-2">
                    This video has no readable captions, so there are no questions for it. Before you tick anything,
                    say the main idea out loud without looking.
                </p>
            );
        case "no_key":
            return (
                <p className="type-body-sm text-text-2">
                    Recall questions need a free Gemini key.{" "}
                    <Link
                        to="/settings"
                        search={{ tab: "ai" }}
                        className="underline underline-offset-2"
                    >
                        Add one in Settings
                    </Link>
                    .
                </p>
            );
        case "error":
            return (
                <div>
                    <p className="type-body-sm text-text-2">{state.message}</p>
                    <Button
                        className="mt-2"
                        variant="secondary"
                        size="sm"
                        onClick={onRetry}
                    >
                        Try again
                    </Button>
                </div>
            );
        default: {
            const _exhaustive: never = state;
            return _exhaustive;
        }
    }
}

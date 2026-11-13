import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
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
        <div className="sy-desk-card sy-desk-recall sy-recall-check">
            <p className="sy-desk-eyebrow">{eyebrow}</p>
            <p className="sy-recall-question" id={`${answerId}-question`}>
                {check.question}
            </p>
            {!revealed ? (
                <>
                    <textarea
                        className="sy-textarea"
                        rows={2}
                        maxLength={600}
                        value={answer}
                        autoFocus={autoFocus}
                        placeholder="Answer from memory, in a sentence or two."
                        aria-labelledby={`${answerId}-question`}
                        onChange={(event) => setAnswer(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) setRevealed(true);
                        }}
                    />
                    <div className="sy-desk-actions">
                        <button type="button" className="sy-button primary" onClick={() => setRevealed(true)}>
                            {answer.trim() ? "Check my answer" : "I don't know, show me"}
                        </button>
                        {onSkip && (
                            <button type="button" className="sy-button quiet" onClick={onSkip}>
                                Skip
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <div className="sy-recall-reveal" ref={revealRef} tabIndex={-1}>
                    {answer.trim() && (
                        <div className="sy-recall-yours">
                            <span>You said</span>
                            <p>{answer.trim()}</p>
                        </div>
                    )}
                    <div className="sy-recall-source">
                        <span>From the video at {formatTimestamp(check.sourceStart)}</span>
                        <blockquote>
                            {check.sourceLines.map((line, index) => (
                                <p key={index}>{line}</p>
                            ))}
                        </blockquote>
                        <p className="sy-recall-gist">
                            <b>In short:</b> {check.answer}
                        </p>
                    </div>
                    <p className="sy-desk-recall-hint">Compare for yourself. If you missed it, replay that moment.</p>
                    <div className="sy-desk-actions">
                        <button type="button" className="sy-button primary" onClick={() => onDone(answer.trim())}>
                            {doneLabel}
                        </button>
                        <button type="button" className="sy-button secondary" onClick={() => onReplay(check.sourceStart)}>
                            <Play size={13} />
                            Replay {formatTimestamp(check.sourceStart)}
                        </button>
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
            return <p className="sy-desk-empty">Writing questions from the video&apos;s transcript…</p>;
        case "no_transcript":
            return (
                <p className="sy-desk-empty">
                    This video has no readable captions, so there are no questions for it. Before you tick anything,
                    say the main idea out loud without looking.
                </p>
            );
        case "no_key":
            return (
                <p className="sy-desk-empty">
                    Recall questions need a free Gemini key.{" "}
                    <Link to="/settings" search={{ tab: "ai" }}>
                        Add one in Settings
                    </Link>
                    .
                </p>
            );
        case "error":
            return (
                <div className="sy-desk-empty">
                    <p>{state.message}</p>
                    <button type="button" className="sy-button secondary" onClick={onRetry}>
                        Try again
                    </button>
                </div>
            );
        default: {
            const _exhaustive: never = state;
            return _exhaustive;
        }
    }
}

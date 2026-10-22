import { useState } from "react";
import type { SrsItem } from "@/types";
import { createReview } from "@/lib/reviews";

export default function ReviewComposer({
    roadmapId,
    source,
    initialAnswer = "",
}: {
    roadmapId: string;
    source: SrsItem["source"];
    initialAnswer?: string;
}) {
    const [open, setOpen] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [answer, setAnswer] = useState(initialAnswer);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    if (!open)
        return (
            <>
                <button
                    className="sy-button quiet"
                    onClick={() => {
                        setAnswer(initialAnswer);
                        setOpen(true);
                        setSaved(false);
                        setError(null);
                    }}
                >
                    Make a review card
                </button>
                {saved && (
                    <p className="sy-form-hint" role="status">
                        Card kept for review.
                    </p>
                )}
            </>
        );
    return (
        <form
            className="sy-form"
            style={{ marginTop: 18 }}
            onSubmit={(event) => {
                event.preventDefault();
                if (!prompt.trim() || !answer.trim()) return;
                try {
                    createReview({ prompt, answer, roadmapId, source });
                    setSaved(true);
                    setPrompt("");
                    setOpen(false);
                } catch {
                    setError(
                        "Could not save this card. Free some browser storage and try again.",
                    );
                }
            }}
        >
            <label>
                Question
                <input
                    className="sy-input"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    required
                    maxLength={1000}
                />
            </label>
            <label>
                Answer
                <textarea
                    className="sy-textarea"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    required
                    maxLength={6000}
                />
            </label>
            <div className="sy-card-actions">
                <button className="sy-button primary">Keep card</button>
                <button
                    className="sy-button quiet"
                    type="button"
                    onClick={() => setOpen(false)}
                >
                    Cancel
                </button>
            </div>
            {error && (
                <p className="sy-error" role="alert">
                    {error}
                </p>
            )}
        </form>
    );
}

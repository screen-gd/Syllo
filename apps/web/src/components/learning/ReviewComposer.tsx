import { useState } from "react";
import { Alert } from "@/components/glaze/ui/alert";
import { Button } from "@/components/glaze/ui/button";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import { Textarea } from "@/components/glaze/ui/textarea";
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
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setAnswer(initialAnswer);
                        setOpen(true);
                        setSaved(false);
                        setError(null);
                    }}
                >
                    Make a review card
                </Button>
                {saved && (
                    <p className="type-caption text-text-2" role="status">
                        Card kept for review.
                    </p>
                )}
            </>
        );
    return (
        <form
            className="mt-4 flex flex-col gap-3"
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
            <Field>
                <FieldLabel>Question</FieldLabel>
                <Input
                    value={prompt}
                    onValueChange={setPrompt}
                    required
                    maxLength={1000}
                />
            </Field>
            <Field>
                <FieldLabel>Answer</FieldLabel>
                <Textarea
                    value={answer}
                    onValueChange={setAnswer}
                    limit={6000}
                    autoGrow
                    minRows={2}
                    maxRows={10}
                />
            </Field>
            <div className="flex gap-2">
                <Button size="sm">Keep card</Button>
                <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => setOpen(false)}
                >
                    Cancel
                </Button>
            </div>
            {error && <Alert status="fail">{error}</Alert>}
        </form>
    );
}

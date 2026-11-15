import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Alert } from "@/components/glaze/ui/alert";
import { Button } from "@/components/glaze/ui/button";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import { Textarea } from "@/components/glaze/ui/textarea";
import { upsertGlossaryTerm } from "@/lib/glossary";
import { getStorage } from "@/lib/storage";

/** Adds a term to a roadmap's glossary from wherever the learner met it. */
export default function TermComposer({ roadmapId }: { roadmapId: string }) {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState("");
    const [definition, setDefinition] = useState("");
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    if (!open)
        return (
            <>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setOpen(true);
                        setSaved(false);
                        setError(null);
                    }}
                >
                    Add a glossary term
                </Button>
                {saved && (
                    <p className="type-caption text-text-2" role="status">
                        Term added.{" "}
                        <Link
                            to="/glossary"
                            search={{ roadmap: roadmapId }}
                            className="underline underline-offset-2"
                        >
                            Open Glossary
                        </Link>
                    </p>
                )}
            </>
        );
    return (
        <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                if (!term.trim() || !definition.trim()) return;
                // Read the stored roadmap so a stale copy never overwrites progress.
                const roadmap = getStorage().getRoadmap(roadmapId);
                if (!roadmap) return;
                try {
                    getStorage().saveRoadmap(
                        upsertGlossaryTerm(roadmap, { term, definition }),
                    );
                    setSaved(true);
                    setTerm("");
                    setDefinition("");
                    setOpen(false);
                } catch {
                    setError(
                        "Could not save this term. Free some browser storage and try again.",
                    );
                }
            }}
        >
            <Field>
                <FieldLabel>Term</FieldLabel>
                <Input
                    value={term}
                    onValueChange={setTerm}
                    required
                    maxLength={200}
                />
            </Field>
            <Field>
                <FieldLabel>Definition</FieldLabel>
                <Textarea
                    value={definition}
                    onValueChange={setDefinition}
                    limit={4000}
                    autoGrow
                    minRows={2}
                    maxRows={10}
                />
            </Field>
            <div className="flex gap-2">
                <Button size="sm">Add term</Button>
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

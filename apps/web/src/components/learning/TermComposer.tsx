import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
                <button
                    className="sy-button quiet"
                    onClick={() => {
                        setOpen(true);
                        setSaved(false);
                        setError(null);
                    }}
                >
                    Add a glossary term
                </button>
                {saved && (
                    <p className="sy-form-hint" role="status">
                        Term added.{" "}
                        <Link to="/glossary" search={{ roadmap: roadmapId }}>
                            Open Glossary
                        </Link>
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
            <label>
                Term
                <input
                    className="sy-input"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    required
                    maxLength={200}
                />
            </label>
            <label>
                Definition
                <textarea
                    className="sy-textarea"
                    value={definition}
                    onChange={(event) => setDefinition(event.target.value)}
                    required
                    maxLength={4000}
                />
            </label>
            <div className="sy-card-actions">
                <button className="sy-button primary">Add term</button>
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

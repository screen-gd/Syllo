"use client";

import { useState } from "react";
import type { SubmissionSection as SubmissionSectionType, Section, Submission } from "@/types";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import Modal from "@/components/shared/Modal";

interface Props {
    section: SubmissionSectionType;
    onUpdate: (updater: (s: Section) => Section) => void;
}

export default function SubmissionsSection({ section, onUpdate }: Props) {
    const [showSubmit, setShowSubmit] = useState(false);
    const [showReview, setShowReview] = useState<string | null>(null);
    const [newSub, setNewSub] = useState({ title: "", description: "", attachment: "" });
    const [reviewFeedback, setReviewFeedback] = useState("");

    const handleSubmit = () => {
        if (!newSub.title.trim()) return;
        const submission: Submission = {
            id: crypto.randomUUID(),
            title: newSub.title,
            description: newSub.description,
            attachment: newSub.attachment || undefined,
            attachmentType: newSub.attachment ? "link" : undefined,
            status: "submitted",
            createdAt: new Date().toISOString(),
        };
        onUpdate((s) => {
            const ss = s as SubmissionSectionType;
            return { ...ss, data: [submission, ...ss.data] };
        });
        setNewSub({ title: "", description: "", attachment: "" });
        setShowSubmit(false);
    };

    const handleReview = (id: string, action: "approved" | "revision") => {
        onUpdate((s) => {
            const ss = s as SubmissionSectionType;
            return {
                ...ss,
                data: ss.data.map((sub: Submission) =>
                    sub.id === id
                        ? { ...sub, status: action, feedback: reviewFeedback, reviewedAt: new Date().toISOString() }
                        : sub
                ),
            };
        });
        setShowReview(null);
        setReviewFeedback("");
    };

    const reviewingSubmission = section.data.find((s) => s.id === showReview);

    if (section.data.length === 0 && !showSubmit) {
        return (
            <EmptyState
                icon="📤"
                title="No submissions yet"
                description="Submit your completed work, assignments, and projects here for review."
                action={{ label: "Submit Work", onClick: () => setShowSubmit(true) }}
            />
        );
    }

    return (
        <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-6 animate-fade-in">
                <h2 className="font-display text-2xl font-bold text-text-primary text-text-primary">📤 {section.title}</h2>
                <button type="button" className="btn btn-primary text-xs" onClick={() => setShowSubmit(true)}>
                    Submit Work
                </button>
            </div>

            {/* Submit form */}
            {showSubmit ? (
                <div className="surface rounded-xl p-4 mb-6 space-y-3 animate-scale-in">
                    <input className="input" placeholder="Submission title…" value={newSub.title} onChange={(e) => setNewSub({ ...newSub, title: e.target.value })} />
                    <textarea className="input min-h-[100px] resize-y" placeholder="Description — what did you accomplish?…" value={newSub.description} onChange={(e) => setNewSub({ ...newSub, description: e.target.value })} />
                    <input className="input" placeholder="Link to your work (optional)…" type="url" value={newSub.attachment} onChange={(e) => setNewSub({ ...newSub, attachment: e.target.value })} />
                    <div className="flex gap-2">
                        <button type="button" className="btn btn-primary" onClick={handleSubmit}>Submit</button>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowSubmit(false)}>Cancel</button>
                    </div>
                </div>
            ) : null}

            {/* Submissions list */}
            <div className="space-y-3">
                {section.data.map((sub, i) => (
                    <div
                        key={sub.id}
                        className="surface rounded-xl p-4 card-hover animate-slide-up content-auto"
                        style={{ animationDelay: `${i * 0.05}s` }}
                    >
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className="font-display font-bold text-text-primary text-sm text-text-primary flex-1">{sub.title}</h3>
                            <StatusBadge status={sub.status} />
                        </div>
                        <p className="text-text-secondary text-sm mb-2">{sub.description}</p>
                        {sub.attachment ? (
                            <a
                                href={sub.attachment}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-soft text-xs hover:underline block mb-2"
                            >
                                📎 View attachment ↗
                            </a>
                        ) : null}
                        {sub.feedback ? (
                            <div className="p-2.5 rounded-lg bg-obsidian-elevated text-xs text-text-secondary mt-2">
                                <span className="font-medium text-text-primary">Feedback:</span> {sub.feedback}
                            </div>
                        ) : null}
                        <div className="flex items-center justify-between mt-3">
                            <span className="text-text-secondary text-[12px] tabular-nums">
                                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(sub.createdAt))}
                            </span>
                            {sub.status === "submitted" ? (
                                <button
                                    type="button"
                                    className="btn btn-ghost text-xs text-indigo-soft"
                                    onClick={() => setShowReview(sub.id)}
                                >
                                    Review
                                </button>
                            ) : null}
                        </div>
                    </div>
                ))}
            </div>

            {/* Review Modal */}
            <Modal
                isOpen={!!showReview}
                onClose={() => { setShowReview(null); setReviewFeedback(""); }}
                title={`Review: ${reviewingSubmission?.title || ""}`}
            >
                <div className="space-y-3">
                    <textarea
                        className="input min-h-[100px] resize-y"
                        placeholder="Provide feedback…"
                        value={reviewFeedback}
                        onChange={(e) => setReviewFeedback(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="btn btn-primary flex-1"
                            onClick={() => showReview && handleReview(showReview, "approved")}
                        >
                            ✅ Approve
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary flex-1"
                            onClick={() => showReview && handleReview(showReview, "revision")}
                        >
                            🔄 Request Revision
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

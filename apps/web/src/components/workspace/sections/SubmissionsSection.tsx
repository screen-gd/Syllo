"use client";

import { useState } from "react";
import type { SubmissionSection as SubmissionSectionType, Section, Submission } from "@/types";
import { External, Icon } from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/glaze/ui/dialog";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import { Textarea } from "@/components/glaze/ui/textarea";

interface Props {
    section: SubmissionSectionType;
    onUpdate: (updater: (s: Section) => Section) => void;
}

/** Submission status shown as a badge: green when approved, amber when it needs a revision. */
const STATUS = {
    pending: { variant: "neutral", label: "Pending" },
    submitted: { variant: "neutral", label: "Submitted" },
    approved: { variant: "ok", label: "Approved" },
    revision: { variant: "warn", label: "Needs revision" },
} as const;

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
            <Empty reason="empty">
                <EmptyHeader>
                    <EmptyTitle>No submissions yet</EmptyTitle>
                    <EmptyDescription>
                        Submit your completed work, assignments, and projects here for review.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button onClick={() => setShowSubmit(true)}>Submit work</Button>
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-3">
                <h2 className="type-heading">{section.title}</h2>
                {!showSubmit ? (
                    <Button size="sm" onClick={() => setShowSubmit(true)}>
                        Submit work
                    </Button>
                ) : null}
            </div>

            {/* Submit form */}
            {showSubmit ? (
                <div className="shell">
                    <div className="panel flex flex-col gap-3 p-3">
                        <Field>
                            <FieldLabel>Title</FieldLabel>
                            <Input
                                placeholder="Submission title"
                                value={newSub.title}
                                onValueChange={(value) => setNewSub({ ...newSub, title: value })}
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Description</FieldLabel>
                            <Textarea
                                resizable
                                placeholder="What did you accomplish?"
                                value={newSub.description}
                                onValueChange={(value) => setNewSub({ ...newSub, description: value })}
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Link to your work (optional)</FieldLabel>
                            <Input
                                type="url"
                                placeholder="https://"
                                value={newSub.attachment}
                                onValueChange={(value) => setNewSub({ ...newSub, attachment: value })}
                            />
                        </Field>
                    </div>
                    <div className="shell-foot flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setShowSubmit(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSubmit}>
                            Submit
                        </Button>
                    </div>
                </div>
            ) : null}

            {/* Submissions list */}
            <div className="flex flex-col gap-3">
                {section.data.map((sub) => {
                    const status = STATUS[sub.status] ?? STATUS.pending;
                    return (
                        <div key={sub.id} className="shell">
                            <div className="panel flex flex-col gap-2 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="flex-1 type-heading-sm">{sub.title}</h3>
                                    <Badge variant={status.variant}>{status.label}</Badge>
                                </div>
                                {sub.description ? (
                                    <p className="type-body-sm text-text-2">{sub.description}</p>
                                ) : null}
                                {sub.attachment ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="self-start"
                                        nativeButton={false}
                                        render={<a href={sub.attachment} target="_blank" rel="noopener noreferrer" />}
                                    >
                                        View attachment
                                        <Icon icon={External} />
                                    </Button>
                                ) : null}
                                {sub.feedback ? (
                                    <p className="rounded-panel bg-field p-3 type-body-sm text-text-2">
                                        <span className="font-medium text-text-1">Feedback:</span> {sub.feedback}
                                    </p>
                                ) : null}
                            </div>
                            <div className="shell-foot flex items-center gap-2">
                                <span className="me-auto type-caption tabular-nums text-text-2">
                                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(sub.createdAt))}
                                </span>
                                {sub.status === "submitted" ? (
                                    <Button size="sm" variant="secondary" onClick={() => setShowReview(sub.id)}>
                                        Review
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Review Modal */}
            <Dialog
                open={!!showReview}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowReview(null);
                        setReviewFeedback("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{`Review: ${reviewingSubmission?.title || ""}`}</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <Field>
                            <FieldLabel>Feedback</FieldLabel>
                            <Textarea
                                resizable
                                placeholder="Provide feedback"
                                value={reviewFeedback}
                                onValueChange={setReviewFeedback}
                            />
                        </Field>
                    </DialogBody>
                    <DialogFooter>
                        <DialogClose>Cancel</DialogClose>
                        <Button
                            variant="secondary"
                            onClick={() => showReview && handleReview(showReview, "revision")}
                        >
                            Request revision
                        </Button>
                        <Button variant="confirm" onClick={() => showReview && handleReview(showReview, "approved")}>
                            Approve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

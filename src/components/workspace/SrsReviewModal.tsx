"use client";

import { useEffect, useMemo, useState } from "react";
import type { SrsItem } from "@/types";
import { applySrsReview, type SrsRating } from "@/lib/spaced-repetition";
import { X, Brain, RotateCcw } from "lucide-react";

interface SrsReviewModalProps {
    isOpen: boolean;
    items: SrsItem[];
    onClose: () => void;
    onSave: (items: SrsItem[]) => void | Promise<void>;
}

const REVIEW_LABELS: Record<SrsRating, { title: string; hint: string; className: string }> = {
    hard: {
        title: "Hard",
        hint: "Bring this card back sooner.",
        className: "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
    },
    okay: {
        title: "Okay",
        hint: "Keep the normal pace.",
        className: "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20",
    },
    easy: {
        title: "Easy",
        hint: "Push this card further out.",
        className: "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20",
    },
};

export default function SrsReviewModal({ isOpen, items, onClose, onSave }: SrsReviewModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [reviewedItems, setReviewedItems] = useState<SrsItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setCurrentIndex(0);
        setShowAnswer(false);
        setReviewedItems([]);
        setIsSaving(false);
    }, [isOpen, items]);

    const currentItem = items[currentIndex];
    const reviewedCount = reviewedItems.length;
    const remainingCount = Math.max(items.length - reviewedCount, 0);

    const progressLabel = useMemo(() => {
        if (items.length === 0) return "No cards due";
        return `Card ${Math.min(currentIndex + 1, items.length)} of ${items.length}`;
    }, [currentIndex, items.length]);

    if (!isOpen) return null;

    const handleRate = async (rating: SrsRating) => {
        if (!currentItem || isSaving) return;

        const updatedItem = applySrsReview(currentItem, rating);
        const nextReviewedItems = [...reviewedItems, updatedItem];

        if (currentIndex === items.length - 1) {
            setReviewedItems(nextReviewedItems);
            setIsSaving(true);
            try {
                await onSave(nextReviewedItems);
                onClose();
            } finally {
                setIsSaving(false);
            }
            return;
        }

        setReviewedItems(nextReviewedItems);
        setCurrentIndex((value) => value + 1);
        setShowAnswer(false);
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-page/80 px-4">
            <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-surface-muted">
                <div className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div>
                        <div className="mb-1 flex items-center gap-2 text-accent">
                            <Brain size={16} />
                            <span className="font-display text-xs">Spaced Review</span>
                        </div>
                        <h2 className="font-display text-2xl text-text">Refresh what you have learned</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-border bg-surface p-2 text-text-muted transition-colors hover:text-text"
                        aria-label="Close review modal"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="border-b border-border px-6 py-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
                        <span>{progressLabel}</span>
                        <span>{remainingCount} due</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-surface">
                        <div
                            className="h-full rounded-full bg-accent transition-all duration-300"
                            style={{ width: `${items.length === 0 ? 0 : (reviewedCount / items.length) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="p-6">
                    {items.length === 0 ? (
                        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center">
                            <RotateCcw size={28} className="mb-4 text-text-muted" />
                            <h3 className="font-display text-2xl text-text">Nothing due right now</h3>
                            <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted">
                                Your review queue is clear. Keep making progress in modules and cards will come back on schedule.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-border bg-surface/40 p-6">
                                <div className="mb-3 font-display text-xs text-text-muted">
                                    Prompt
                                </div>
                                <p className="font-display text-3xl leading-tight text-text">{currentItem?.prompt}</p>
                            </div>

                            <div className="rounded-2xl border border-border bg-surface-muted/60 p-6">
                                <div className="mb-3 font-display text-xs text-text-muted">
                                    Answer
                                </div>
                                {showAnswer ? (
                                    <p className="text-base leading-relaxed text-text">{currentItem?.answer}</p>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowAnswer(true)}
                                        className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
                                    >
                                        Reveal answer
                                    </button>
                                )}
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                {(["hard", "okay", "easy"] as SrsRating[]).map((rating) => {
                                    const config = REVIEW_LABELS[rating];
                                    return (
                                        <button
                                            key={rating}
                                            type="button"
                                            disabled={!showAnswer || isSaving}
                                            onClick={() => void handleRate(rating)}
                                            className={`rounded-2xl border px-4 py-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${config.className}`}
                                        >
                                            <div className="font-display text-xs">{config.title}</div>
                                            <div className="mt-2 text-sm leading-relaxed">{config.hint}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

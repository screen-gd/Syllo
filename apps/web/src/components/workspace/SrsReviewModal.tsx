"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon, Retry } from "@/components/glaze/icon";
import { Button } from "@/components/glaze/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/glaze/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/glaze/ui/empty-state";
import { Progress } from "@/components/glaze/ui/progress";
import type { SrsItem } from "@/types";
import { applySrsReview, type SrsRating } from "@/lib/spaced-repetition";

interface SrsReviewModalProps {
    isOpen: boolean;
    items: SrsItem[];
    onClose: () => void;
    onSave: (items: SrsItem[]) => void | Promise<void>;
}

const REVIEW_LABELS: Record<SrsRating, { title: string; hint: string }> = {
    hard: {
        title: "Hard",
        hint: "Bring this card back sooner.",
    },
    okay: {
        title: "Okay",
        hint: "Keep the normal pace.",
    },
    easy: {
        title: "Easy",
        hint: "Push this card further out.",
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
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Refresh what you have learned</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <div className="mb-2 flex items-center justify-between type-caption text-text-2">
                        <span>{progressLabel}</span>
                        <span>{remainingCount} due</span>
                    </div>
                    <Progress
                        value={
                            items.length === 0
                                ? 0
                                : (reviewedCount / items.length) * 100
                        }
                        aria-label="Review progress"
                    />

                    <div className="mt-5">
                        {items.length === 0 ? (
                            <Empty>
                                <EmptyHeader>
                                    <Icon icon={Retry} size={20} />
                                    <EmptyTitle>
                                        Nothing due right now
                                    </EmptyTitle>
                                    <EmptyDescription>
                                        Your review queue is clear. Keep making
                                        progress in modules and cards will come
                                        back on schedule.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent />
                            </Empty>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="well rounded-panel p-3">
                                    <p className="type-caption text-text-2">
                                        Prompt
                                    </p>
                                    <p className="mt-2 type-heading">
                                        {currentItem?.prompt}
                                    </p>
                                </div>

                                <div className="well rounded-panel p-3">
                                    <p className="type-caption text-text-2">
                                        Answer
                                    </p>
                                    {showAnswer ? (
                                        <p className="mt-2 type-body">
                                            {currentItem?.answer}
                                        </p>
                                    ) : (
                                        <Button
                                            variant="secondary"
                                            className="mt-2"
                                            onClick={() => setShowAnswer(true)}
                                        >
                                            Reveal answer
                                        </Button>
                                    )}
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3">
                                    {(["hard", "okay", "easy"] as SrsRating[]).map(
                                        (rating) => {
                                            const config =
                                                REVIEW_LABELS[rating];
                                            return (
                                                <Button
                                                    key={rating}
                                                    variant="secondary"
                                                    disabled={
                                                        !showAnswer || isSaving
                                                    }
                                                    onClick={() =>
                                                        void handleRate(rating)
                                                    }
                                                >
                                                    {config.title}
                                                </Button>
                                            );
                                        },
                                    )}
                                </div>
                                <p className="type-caption text-text-2">
                                    {REVIEW_LABELS.hard.hint}{" "}
                                    {REVIEW_LABELS.okay.hint}{" "}
                                    {REVIEW_LABELS.easy.hint}
                                </p>
                            </div>
                        )}
                    </div>
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}

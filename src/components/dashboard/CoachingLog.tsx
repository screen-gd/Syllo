"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { getActiveApiKey, getActiveModel, getUserConfig } from "@/lib/userConfig";
import type { Roadmap } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ReviewState {
    summary: string;
    strengths: string[];
    risks: string[];
    nextActions: string[];
}

export default function CoachingLog({ roadmaps }: { roadmaps: Roadmap[] }) {
    const [roadmapId, setRoadmapId] = useState(roadmaps[0]?.id ?? "");
    const [topics, setTopics] = useState("");
    const [nextSteps, setNextSteps] = useState("");
    const [durationMinutes, setDurationMinutes] = useState(30);
    const [saving, setSaving] = useState(false);
    const [reviewing, setReviewing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [review, setReview] = useState<ReviewState | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch("/api/dashboard/coaching", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roadmapId,
                    durationMinutes,
                    topics: topics.split(",").map((item) => item.trim()).filter(Boolean),
                    nextSteps,
                    date: new Date().toISOString(),
                }),
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.error ?? "Failed to save coaching session");
            }
            setMessage("Coaching session saved.");
            setTopics("");
            setNextSteps("");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to save coaching session");
        } finally {
            setSaving(false);
        }
    };

    const handleReview = async () => {
        setReviewing(true);
        setMessage(null);
        try {
            const config = getUserConfig();
            const activeApiKey = getActiveApiKey(config);
            const response = await fetch("/api/dashboard/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roadmapId,
                    userApiKey: config.useCustomKey ? activeApiKey : undefined,
                    userModel: config.useCustomKey ? getActiveModel(config) : undefined,
                    userProvider: config.useCustomKey ? config.provider : undefined,
                }),
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(
                    payload.error === "insufficient_credits"
                        ? "Not enough credits for a 90-day review."
                        : payload.error ?? "Failed to generate review",
                );
            }
            setReview(payload.review as ReviewState);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to generate review");
        } finally {
            setReviewing(false);
        }
    };

    if (roadmaps.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <p className="eyebrow">Coaching log</p>
                    <CardTitle className="mt-3 font-display text-2xl text-text-primary">
                        Record a session or generate a 90-day review
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="studio-empty p-5 text-left text-sm leading-7 text-text-secondary">
                        No synced workspaces are available yet for coaching notes or review generation.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <p className="eyebrow">Coaching log</p>
                <CardTitle className="mt-3 font-display text-2xl text-text-primary">
                    Record a session or generate a 90-day review
                </CardTitle>
            </CardHeader>
            <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="studio-micro-grid space-y-4 p-5">
                    <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-text-secondary">Workspace</span>
                        <select
                            value={roadmapId}
                            onChange={(event) => setRoadmapId(event.target.value)}
                            className="studio-input w-full appearance-none"
                        >
                            {roadmaps.map((roadmap) => (
                                <option key={roadmap.id} value={roadmap.id}>
                                    {roadmap.title}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-text-secondary">Duration (minutes)</span>
                        <Input
                            type="number"
                            min={5}
                            step={5}
                            value={durationMinutes}
                            onChange={(event) => setDurationMinutes(Number(event.target.value) || 30)}
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-text-secondary">Topics</span>
                        <Input
                            value={topics}
                            onChange={(event) => setTopics(event.target.value)}
                            placeholder="Discovery, blockers, shipping cadence"
                            className="placeholder:text-text-secondary/60"
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-text-secondary">Next steps</span>
                        <textarea
                            value={nextSteps}
                            onChange={(event) => setNextSteps(event.target.value)}
                            rows={4}
                            className="studio-input w-full resize-y"
                        />
                    </label>

                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !roadmapId}
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                            Save coaching note
                        </Button>
                        <Button
                            type="button"
                            onClick={handleReview}
                            disabled={reviewing || !roadmapId}
                            variant="secondary"
                        >
                            {reviewing ? <Loader2 size={14} className="animate-spin" /> : null}
                            Generate 90-day review
                        </Button>
                    </div>

                    {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
                </div>

                <div className="studio-micro-grid p-5">
                    {review ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Summary</p>
                                <p className="mt-2 text-sm leading-7 text-text-primary">{review.summary}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Strengths</p>
                                <ul className="mt-2 space-y-2 text-sm text-text-primary">
                                    {review.strengths.map((item) => (
                                        <li key={item}>- {item}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Risks</p>
                                <ul className="mt-2 space-y-2 text-sm text-text-primary">
                                    {review.risks.map((item) => (
                                        <li key={item}>- {item}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Next actions</p>
                                <ul className="mt-2 space-y-2 text-sm text-text-primary">
                                    {review.nextActions.map((item) => (
                                        <li key={item}>- {item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="studio-empty flex min-h-60 items-center justify-center px-6 text-center text-sm leading-7 text-text-secondary">
                            Generate a 90-day review to summarize strengths, risks, and recommended next actions for a selected workspace.
                        </div>
                    )}
                </div>
            </div>
            </CardContent>
        </Card>
    );
}

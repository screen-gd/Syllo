"use client";

import { useEffect, useState, useTransition } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useSearchParams } from "@/lib/router-nav";
import { cn } from "@/lib/utils";

const modeOptions = [
    { label: "All", value: "" },
    { label: "General", value: "general" },
    { label: "Structured", value: "intern" },
];

const typeOptions = [
    { label: "Everything", value: "" },
    { label: "Roadmaps", value: "roadmap" },
    { label: "Playbooks", value: "playbook" },
    { label: "Curriculums", value: "curriculum" },
    { label: "Strategies", value: "strategy" },
    { label: "Plans", value: "plan" },
];

export default function GalleryFilters() {
    const navigate = useNavigate();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [query, setQuery] = useState(searchParams.get("q") ?? "");
    const mode = searchParams.get("mode") ?? "";
    const contentType = searchParams.get("contentType") ?? "";

    useEffect(() => {
        setQuery(searchParams.get("q") ?? "");
    }, [searchParams]);

    const updateParams = (updates: Record<string, string>) => {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            if (value) params.set(key, value);
            else params.delete(key);
        }

        startTransition(() => {
            navigate({ to: ".", search: Object.fromEntries(params), replace: true });
        });
    };

    return (
        <div className="space-y-6 border-b border-border pb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" role="tablist">
                        {modeOptions.map((option) => (
                            <button
                                key={option.label}
                                type="button"
                                role="tab"
                                aria-selected={mode === option.value}
                                onClick={() => updateParams({ mode: option.value })}
                                className={cn(
                                    "border-b pb-1 transition-colors",
                                    mode === option.value
                                        ? "border-[var(--color-accent)] text-text-primary"
                                        : "border-transparent text-text-muted hover:text-text-primary",
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" role="tablist">
                        {typeOptions.map((option) => (
                            <button
                                key={option.label}
                                type="button"
                                role="tab"
                                aria-selected={contentType === option.value}
                                onClick={() => updateParams({ contentType: option.value })}
                                className={cn(
                                    "transition-colors",
                                    contentType === option.value ? "text-text-primary" : "text-text-muted hover:text-text-primary",
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <label className="flex min-h-11 w-full items-center gap-3 rounded-md border border-border bg-[var(--color-surface)] px-4 xl:max-w-sm">
                    <Search size={16} className="text-text-muted" aria-hidden="true" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") updateParams({ q: query });
                        }}
                        onBlur={() => updateParams({ q: query })}
                        placeholder="Search gallery"
                        aria-label="Search gallery"
                        className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                    />
                    {isPending ? <span className="text-xs text-text-muted">Updating</span> : null}
                </label>
            </div>
        </div>
    );
}

import { Check, FileText, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp, humanDuration } from "@/lib/scout/format";
import type { ScoutResource } from "@/lib/scout/types";

interface PickListProps {
    resources: ScoutResource[];
    selected: Set<string>;
    onToggle: (id: string) => void;
}

export default function PickList({
    resources,
    selected,
    onToggle,
}: PickListProps) {
    return (
        <ul className="divide-y divide-border">
            {resources.map((resource) => {
                const checked = selected.has(resource.id);
                const Icon = resource.kind === "video" ? Video : FileText;
                const quote = resource.keyPoints.find(
                    (point) => point.quote,
                )?.quote;
                const chapters = resource.chapters.slice(0, 4);

                return (
                    <li key={resource.id} className="py-5">
                        <div className="flex items-start gap-4">
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={checked}
                                aria-label={`Keep ${resource.title}`}
                                onClick={() => onToggle(resource.id)}
                                className={cn(
                                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                                    checked
                                        ? "border-text bg-text text-page"
                                        : "border-border-strong hover:border-text-soft",
                                )}
                            >
                                {checked ? (
                                    <Check size={13} strokeWidth={3} />
                                ) : null}
                            </button>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-soft">
                                    <span className="inline-flex items-center gap-1.5">
                                        <Icon size={11} /> {resource.kind}
                                    </span>
                                    {resource.creator ? (
                                        <span className="normal-case tracking-normal text-[var(--color-text-muted)]">
                                            {resource.creator}
                                        </span>
                                    ) : null}
                                    {resource.durationSeconds ? (
                                        <span className="tabular-nums">
                                            {humanDuration(
                                                resource.durationSeconds,
                                            )}
                                        </span>
                                    ) : null}
                                    {resource.transcriptStatus ===
                                        "unavailable" ||
                                    resource.transcriptStatus === "skipped" ? (
                                        <span className="normal-case tracking-normal text-warning/80">
                                            description only
                                        </span>
                                    ) : null}
                                </div>

                                <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1.5 block break-words text-[15px] font-medium leading-snug text-[var(--color-text)] underline-offset-4 hover:underline"
                                >
                                    {resource.title}
                                </a>

                                {resource.summary ? (
                                    <p className="mt-1.5 break-words text-sm leading-6 text-[var(--color-text-muted)]">
                                        {resource.summary}
                                    </p>
                                ) : null}

                                {quote ? (
                                    <p className="mt-2 border-l-2 border-border-strong pl-3 text-sm italic leading-6 text-[var(--color-text-muted)]">
                                        “{quote}”
                                    </p>
                                ) : null}

                                {chapters.length > 0 ? (
                                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                                        {chapters.map((chapter) => (
                                            <li
                                                key={`${resource.id}-${chapter.startSeconds}`}
                                            >
                                                <a
                                                    href={chapter.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-baseline gap-1.5 text-xs text-[var(--color-text-soft)] underline-offset-4 hover:text-[var(--color-text)] hover:underline"
                                                >
                                                    <span className="tabular-nums text-[var(--color-accent)]">
                                                        {formatTimestamp(
                                                            chapter.startSeconds,
                                                        )}
                                                    </span>
                                                    {chapter.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}

                                {resource.skillTags.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {resource.skillTags
                                            .slice(0, 4)
                                            .map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="studio-badge text-text-muted"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

import { Document, FileVideo, Icon } from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Switch } from "@/components/glaze/ui/switch";
import { formatTimestamp, humanDuration } from "@/lib/scout/format";
import {
    groupPicks,
    PICK_GROUP_LABEL,
    PICK_ROLE_LABEL,
    type PickRole,
} from "@/lib/scout/picks";
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
        <div>
            {groupPicks(resources).map((group) => (
                <section key={group.level} className="mt-6 first:mt-0">
                    <h3 className="type-label text-text-2">
                        {PICK_GROUP_LABEL[group.level]}
                    </h3>
                    <ul className="mt-2 flex flex-col divide-y divide-line-faint">
                        {group.items.map(({ resource, role }) => (
                            <PickRow
                                key={resource.id}
                                resource={resource}
                                role={role}
                                checked={selected.has(resource.id)}
                                onToggle={onToggle}
                            />
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}

function PickRow({
    resource,
    role,
    checked,
    onToggle,
}: {
    resource: ScoutResource;
    role: PickRole;
    checked: boolean;
    onToggle: (id: string) => void;
}) {
    const quote = resource.keyPoints.find((point) => point.quote)?.quote;
    const chapters = resource.chapters.slice(0, 4);

    return (
        <li className="py-5">
            <div className="flex items-start gap-4">
                <Switch
                    className="mt-1"
                    aria-label={`Keep ${resource.title}`}
                    checked={checked}
                    onCheckedChange={() => onToggle(resource.id)}
                />

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-caption text-text-2">
                        <span className="inline-flex items-center gap-1.5">
                            <Icon
                                icon={
                                    resource.kind === "video"
                                        ? FileVideo
                                        : Document
                                }
                            />{" "}
                            {resource.kind}
                        </span>
                        <Badge>{PICK_ROLE_LABEL[role]}</Badge>
                        {resource.creator ? (
                            <span>{resource.creator}</span>
                        ) : null}
                        {resource.durationSeconds ? (
                            <span>{humanDuration(resource.durationSeconds)}</span>
                        ) : null}
                        {resource.transcriptStatus === "unavailable" ||
                        resource.transcriptStatus === "skipped" ? (
                            <span>description only</span>
                        ) : null}
                    </div>

                    <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 block break-words type-label text-text-1 underline-offset-4 hover:underline"
                    >
                        {resource.title}
                    </a>

                    {resource.summary ? (
                        <p className="mt-1.5 break-words type-body-sm text-text-2">
                            {resource.summary}
                        </p>
                    ) : null}

                    {quote ? (
                        <p className="mt-2 type-body-sm italic text-text-2">
                            “{quote}”
                        </p>
                    ) : null}

                    {chapters.length > 0 ? (
                        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                            {chapters.map((chapter) => (
                                <li key={`${resource.id}-${chapter.startSeconds}`}>
                                    <a
                                        href={chapter.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-baseline gap-1.5 type-caption text-text-2 underline-offset-4 hover:text-text-1 hover:underline"
                                    >
                                        <span>
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
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {resource.skillTags.slice(0, 4).map((tag) => (
                                <Badge key={tag}>{tag}</Badge>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </li>
    );
}

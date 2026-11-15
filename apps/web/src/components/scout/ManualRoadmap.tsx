import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Alert } from "@/components/glaze/ui/alert";
import { Button } from "@/components/glaze/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/glaze/ui/collapsible";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import { Textarea } from "@/components/glaze/ui/textarea";
import { getStorage } from "@/lib/storage";
import { getYouTubeId } from "@/lib/video-utils";
import { safeResourceUrl } from "@/lib/learning";
import type { Roadmap, Task } from "@/types";

export default function ManualRoadmap() {
    const [title, setTitle] = useState("");
    const [links, setLinks] = useState("");
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    function create() {
        const urls = [
            ...new Set(
                links
                    .split(/\n/)
                    .map((value) => value.trim())
                    .filter(Boolean),
            ),
        ];
        if (!title.trim() || !urls.length) {
            setError("Add a topic title and at least one resource URL.");
            return;
        }
        if (urls.some((url) => !safeResourceUrl(url))) {
            setError("Use a full http or https URL for each resource.");
            return;
        }
        const id = crypto.randomUUID();
        const tasks: Task[] = urls.map((url, index) => {
            const isVideo = !!getYouTubeId(url);
            return {
                id: crypto.randomUUID(),
                title: `${isVideo ? "Watch" : "Read"} resource ${index + 1}`,
                description: url,
                completed: false,
                notes: "",
                subtasks: [],
                attachments: [
                    {
                        id: crypto.randomUUID(),
                        title: new URL(url).hostname,
                        url,
                        type: isVideo ? "video" : "link",
                        description: "Added by you",
                    },
                ],
            };
        });
        const roadmap: Roadmap = {
            id,
            title: title.trim(),
            mode: "general",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            rawContent: links,
            goal: title.trim(),
            sections: [
                {
                    id: crypto.randomUUID(),
                    title: "Your resources",
                    order: 0,
                    type: "module",
                    data: {
                        description:
                            "Resources in the order you added them. Edit the roadmap to change the order or add tasks.",
                        tasks,
                        resources: [],
                        videos: [],
                        completed: false,
                    },
                },
            ],
        };
        try {
            getStorage().saveRoadmap(roadmap);
            void navigate({ to: "/learn", search: { roadmap: id } });
        } catch {
            setError(
                "Could not save this roadmap. Free some browser storage and try again.",
            );
        }
    }
    return (
        <Collapsible className="mt-4">
            <CollapsibleTrigger className="-ms-2.5">Add resources yourself</CollapsibleTrigger>
            <CollapsibleContent>
            <p className="mt-2 type-caption text-text-2">
                No key or AI calls needed. Your order is preserved.
            </p>
            <div className="mt-4 flex flex-col gap-3">
                <Field>
                    <FieldLabel>Learning topic</FieldLabel>
                    <Input
                        value={title}
                        onValueChange={setTitle}
                        placeholder="Build AI features"
                        maxLength={200}
                    />
                </Field>
                <Field>
                    <FieldLabel>Resource URLs, one per line</FieldLabel>
                    <Textarea
                        value={links}
                        onValueChange={setLinks}
                        placeholder="https://…"
                        autoGrow
                        minRows={3}
                        maxRows={10}
                    />
                </Field>
                <div>
                    <Button variant="secondary" onClick={create}>
                        Create roadmap
                    </Button>
                </div>
                {error && <Alert status="fail">{error}</Alert>}
            </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

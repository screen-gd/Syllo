import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Add, Icon } from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/glaze/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { ItemGroup } from "@/components/glaze/ui/item";
import {
    SegmentedControl,
    SegmentedControlItem,
} from "@/components/glaze/ui/segmented-control";
import { Select } from "@/components/glaze/ui/select";
import { SkeletonText } from "@/components/glaze/ui/skeleton";
import WorkspaceLibraryCard from "@/components/workspaces/WorkspaceLibraryCard";
import PageFrame from "@/components/layout/PageFrame";
import { getStorage } from "@/lib/storage";
import { getRoadmapStats } from "@/lib/workspace-stats";
import { useLearningRoadmaps } from "@/hooks/useLearningRoadmaps";

type LibraryFilter = "all" | "in-progress" | "completed";
type SortMode = "recent" | "title" | "completion";

export default function WorkspacesPage() {
    const { roadmaps, loaded: mounted } = useLearningRoadmaps();
    const [filter, setFilter] = useState<LibraryFilter>("all");
    const [sortMode, setSortMode] = useState<SortMode>("recent");

    const filteredRoadmaps = useMemo(() => {
        const nextRoadmaps = [...roadmaps].filter((roadmap) => {
            if (filter === "all") return true;

            const stats = getRoadmapStats(roadmap);
            if (filter === "completed") {
                return stats.progressState === "completed";
            }

            return stats.progressState === "in-progress";
        });

        nextRoadmaps.sort((left, right) => {
            if (sortMode === "title") {
                return left.title.localeCompare(right.title);
            }

            if (sortMode === "completion") {
                return (
                    getRoadmapStats(right).percent -
                    getRoadmapStats(left).percent
                );
            }

            const leftDate = new Date(
                left.updatedAt || left.createdAt,
            ).getTime();
            const rightDate = new Date(
                right.updatedAt || right.createdAt,
            ).getTime();
            return rightDate - leftDate;
        });

        return nextRoadmaps;
    }, [filter, roadmaps, sortMode]);

    const counts = useMemo(() => {
        const states = roadmaps.map(
            (roadmap) => getRoadmapStats(roadmap).progressState,
        );
        return {
            all: roadmaps.length,
            "in-progress": states.filter((state) => state === "in-progress")
                .length,
            completed: states.filter((state) => state === "completed").length,
        } satisfies Record<LibraryFilter, number>;
    }, [roadmaps]);

    return (
        <PageFrame
            title="Learning topics"
            subtitle="Choose a topic to continue learning."
            actions={
                <Button
                    render={<Link to="/create" />}
                    nativeButton={false}
                >
                    <Icon icon={Add} />
                    Add roadmap
                </Button>
            }
        >
            <>
                <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl
                        aria-label="Filter workspaces"
                        value={filter}
                        onValueChange={(value) =>
                            setFilter(value as LibraryFilter)
                        }
                    >
                        <SegmentedControlItem
                            value="all"
                            count={mounted ? counts.all : undefined}
                        >
                            All
                        </SegmentedControlItem>
                        <SegmentedControlItem
                            value="in-progress"
                            count={mounted ? counts["in-progress"] : undefined}
                        >
                            In progress
                        </SegmentedControlItem>
                        <SegmentedControlItem
                            value="completed"
                            count={mounted ? counts.completed : undefined}
                        >
                            Completed
                        </SegmentedControlItem>
                    </SegmentedControl>
                    <div className="w-full sm:ms-auto sm:w-44">
                        <Select
                            native
                            aria-label="Sort"
                            value={sortMode}
                            onValueChange={(value) =>
                                setSortMode((value ?? "recent") as SortMode)
                            }
                            items={[
                                { value: "recent", label: "Recent first" },
                                { value: "title", label: "By title" },
                                { value: "completion", label: "By progress" },
                            ]}
                        />
                    </div>
                </div>

                {mounted ? (
                    filteredRoadmaps.length > 0 ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <h2 className="type-heading-sm">Topics</h2>
                                </CardTitle>
                                <CardAction>
                                    <Badge count={filteredRoadmaps.length} />
                                </CardAction>
                            </CardHeader>
                            <CardContent flush>
                                <ItemGroup variant="plain" aria-label="Topics">
                                    {filteredRoadmaps.map((roadmap) => (
                                        <WorkspaceLibraryCard
                                            key={roadmap.id}
                                            roadmap={roadmap}
                                            onDelete={(id) => {
                                                getStorage().deleteRoadmap(id);
                                            }}
                                            onRename={(id, nextTitle) => {
                                                getStorage().updateRoadmap(
                                                    id,
                                                    {
                                                        title: nextTitle,
                                                    },
                                                );
                                            }}
                                        />
                                    ))}
                                </ItemGroup>
                            </CardContent>
                        </Card>
                    ) : (
                        <Empty
                            reason={roadmaps.length === 0 ? "empty" : "no-results"}
                        >
                            <EmptyHeader>
                                <EmptyTitle>
                                    {roadmaps.length === 0
                                        ? "No learning topics yet"
                                        : "No learning topic matches this filter"}
                                </EmptyTitle>
                                {roadmaps.length === 0 && (
                                    <EmptyDescription>
                                        Start with Scout or add your own
                                        roadmap.
                                    </EmptyDescription>
                                )}
                            </EmptyHeader>
                            <EmptyContent>
                                {roadmaps.length === 0 ? (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            render={<Link to="/scout" />}
                                            nativeButton={false}
                                        >
                                            Open Scout
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setFilter("all")}
                                    >
                                        Show all
                                    </Button>
                                )}
                            </EmptyContent>
                        </Empty>
                    )
                ) : (
                    <Card>
                            <CardHeader>
                                <CardTitle>
                                    <h2 className="type-heading-sm">Topics</h2>
                                </CardTitle>
                            </CardHeader>
                            <CardContent
                                className="gap-3"
                                role="status"
                                aria-label="Loading"
                            >
                                <span className="sr-only">Loading</span>
                                {[0, 1, 2].map((row) => (
                                    <SkeletonText
                                        key={row}
                                        type="body"
                                        last={0.4}
                                    />
                                ))}
                            </CardContent>
                    </Card>
                )}
            </>
        </PageFrame>
    );
}

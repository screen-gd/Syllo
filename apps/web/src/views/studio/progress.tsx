import { Link } from "@tanstack/react-router";
import { ArrowRight, Icon } from "@/components/glaze/icon";
import { Button } from "@/components/glaze/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/glaze/ui/card";
import { Chart } from "@/components/glaze/ui/chart";
import {
    DataList,
    DataListItem,
    DataListLabel,
    DataListValue,
} from "@/components/glaze/ui/data-list";
import {
    Empty,
    EmptyContent,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemLink,
    ItemMeta,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { Progress } from "@/components/glaze/ui/progress";
import { SkeletonText, SkeletonSwap } from "@/components/glaze/ui/skeleton";
import { useReviews } from "@/hooks/useReviews";
import { getLadder, LEVEL_LABEL } from "@/lib/ladder";
import {
    normalizeLearningRecord,
    recentActivity,
} from "@/lib/learning-session";
import { collectNotes } from "@/lib/notes";
import { isDue, isScheduled } from "@/lib/reviews";
import { getStorage } from "@/lib/storage";
import { getRoadmapStats } from "@/lib/workspace-stats";
import PageFrame from "@/components/layout/PageFrame";

/** The Learning Record at a glance: streak, the last week, and each topic. */
export default function ProgressPage() {
    const { reviews, roadmaps, records, loaded } = useReviews();
    if (!loaded)
        return (
            <PageFrame title="Progress">
                <SkeletonSwap
                    loading
                    label="Loading progress"
                    fallback={
                <>
                    <section className="shell">
                        <div
                            className="panel p-3"
                        >
                            <SkeletonText type="heading-sm" last={0.2} />
                            <div className="mt-3">
                                <SkeletonText type="body" last={0.42} />
                                <SkeletonText type="body-sm" last={0.64} />
                                <SkeletonText type="body-sm" last={0.36} />
                            </div>
                        </div>
                    </section>
                    <section className="shell">
                        <div className="panel p-3">
                            <SkeletonText type="heading-sm" last={0.14} />
                            {[0, 1, 2].map((row) => (
                                <div key={row} className="mt-3">
                                    <SkeletonText type="body" last={0.34} />
                                    <SkeletonText type="body-sm" last={0.68} />
                                </div>
                            ))}
                        </div>
                    </section>
                </>
                    }
                >
                    {null}
                </SkeletonSwap>
            </PageFrame>
        );

    const record = normalizeLearningRecord(getStorage().getLearningRecord());
    const week = recentActivity(record);
    const weekTotal = week.reduce((total, day) => total + day.count, 0);
    const notes = collectNotes(records, roadmaps);
    const cards = reviews.filter(isScheduled);
    const dueCount = cards.filter((item) => isDue(item)).length;

    return (
        <PageFrame title="Progress">
            <>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <h2 className="type-heading-sm">Last 7 days</h2>
                        </CardTitle>
                    </CardHeader>
                        <CardContent>
                            <DataList variant="plain">
                                <DataListItem>
                                    <DataListLabel>Day streak</DataListLabel>
                                    <DataListValue>
                                        {record.currentStreak}
                                    </DataListValue>
                                </DataListItem>
                                <DataListItem>
                                    <DataListLabel>
                                        Lessons this week
                                    </DataListLabel>
                                    <DataListValue>{weekTotal}</DataListValue>
                                </DataListItem>
                                <DataListItem>
                                    <DataListLabel>Cards ready</DataListLabel>
                                    <DataListValue>
                                        <Link to="/reviews">{dueCount}</Link>
                                    </DataListValue>
                                </DataListItem>
                                <DataListItem>
                                    <DataListLabel>Notes</DataListLabel>
                                    <DataListValue>
                                        <Link to="/notes">{notes.length}</Link>
                                    </DataListValue>
                                </DataListItem>
                            </DataList>
                            <Chart
                                type="sparkline"
                                label="Lessons finished on each of the last 7 days"
                                data={week.map((day) => day.count)}
                                unit="count"
                                className="mt-1 w-full"
                            />
                        </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            <h2 className="type-heading-sm">Topics</h2>
                        </CardTitle>
                        <CardAction>
                            <Button
                                variant="ghost"
                                size="sm"
                                render={<Link to="/workspaces" />}
                                nativeButton={false}
                            >
                                View all
                            </Button>
                        </CardAction>
                    </CardHeader>
                        {roadmaps.length === 0 ? (
                            <CardContent>
                                <Empty variant="plain" reason="empty">
                                    <EmptyHeader>
                                        <EmptyTitle>
                                            Progress appears once you start a
                                            topic
                                        </EmptyTitle>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            render={<Link to="/scout" />}
                                            nativeButton={false}
                                        >
                                            Open Scout
                                            <Icon icon={ArrowRight} />
                                        </Button>
                                    </EmptyContent>
                                </Empty>
                            </CardContent>
                        ) : (
                            <CardContent flush>
                            <ItemGroup variant="plain" aria-label="Topics">
                                {roadmaps.map((roadmap) => {
                                    const ladder = getLadder(roadmap);
                                    const stats = getRoadmapStats(roadmap);
                                    const level = ladder.levels.find(
                                        (entry) =>
                                            entry.level === ladder.current,
                                    );
                                    const noteCount = notes.filter(
                                        (note) => note.groupId === roadmap.id,
                                    ).length;
                                    const cardCount = cards.filter(
                                        (item) => item.roadmapId === roadmap.id,
                                    ).length;
                                    return (
                                        <Item key={roadmap.id}>
                                            <ItemContent>
                                                <ItemTitle>
                                                    <ItemLink
                                                        render={
                                                            <Link
                                                                to="/learn"
                                                                search={{
                                                                    roadmap:
                                                                        roadmap.id,
                                                                }}
                                                            />
                                                        }
                                                    >
                                                        {roadmap.title}
                                                    </ItemLink>
                                                </ItemTitle>
                                                <ItemDescription>
                                                    {level
                                                        ? `${LEVEL_LABEL[level.level]} · ${level.coreDone}/${level.coreTotal} core`
                                                        : ladder.levels.length
                                                          ? "Ladder complete"
                                                          : "No lessons yet"}
                                                    {" · "}
                                                    {stats.completedTasks}/
                                                    {stats.totalTasks} lessons
                                                    {" · "}
                                                    {cardCount} card
                                                    {cardCount === 1 ? "" : "s"}
                                                </ItemDescription>
                                                <Progress
                                                    mode="meter"
                                                    size="sm"
                                                    className="mt-1.5 max-w-56"
                                                    value={stats.percent}
                                                    max={100}
                                                    warnAt={null}
                                                    failAt={null}
                                                    aria-label={`${roadmap.title} progress`}
                                                />
                                            </ItemContent>
                                            <ItemMeta>
                                                {stats.percent}%
                                            </ItemMeta>
                                            <ItemActions>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        render={
                                                            <Link
                                                                to="/notes"
                                                                search={{
                                                                    roadmap:
                                                                        roadmap.id,
                                                                }}
                                                            />
                                                        }
                                                        nativeButton={false}
                                                    >
                                                        {noteCount} note
                                                        {noteCount === 1
                                                            ? ""
                                                            : "s"}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        render={
                                                            <Link
                                                                to="/glossary"
                                                                search={{
                                                                    roadmap:
                                                                        roadmap.id,
                                                                }}
                                                            />
                                                        }
                                                        nativeButton={false}
                                                    >
                                                        Glossary
                                                    </Button>
                                            </ItemActions>
                                        </Item>
                                    );
                                })}
                            </ItemGroup>
                            </CardContent>
                        )}
                </Card>
            </>
        </PageFrame>
    );
}

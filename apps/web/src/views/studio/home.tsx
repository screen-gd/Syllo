import { Link } from "@tanstack/react-router";
import {
    ArrowRight,
    Create,
    Icon,
    Library,
    Play,
    Scout,
} from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
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
    ItemMedia,
    ItemMeta,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { Progress } from "@/components/glaze/ui/progress";
import {
    Skeleton,
    SkeletonSwap,
    SkeletonText,
} from "@/components/glaze/ui/skeleton";
import { useReviews } from "@/hooks/useReviews";
import { taskVideo } from "@/lib/learning";
import { getLadder, levelUpReady, LEVEL_LABEL, nextCoreItem } from "@/lib/ladder";
import { getYouTubeId, getVideoStartSeconds } from "@/lib/video-utils";
import { personalEntries } from "@/lib/personal/store";
import {
    normalizeLearningRecord,
    recentActivity,
} from "@/lib/learning-session";
import { collectNotes } from "@/lib/notes";
import { formatInterval, isDue, isScheduled } from "@/lib/reviews";
import { getStorage } from "@/lib/storage";
import { formatTimestamp } from "@/lib/scout/format";
import BookCover from "@/components/learning/BookCover";
import PageFrame from "@/components/layout/PageFrame";

/** First things to do on an empty Home, in the order a new learner needs them. */
const STARTERS = [
    {
        to: "/scout",
        icon: Scout,
        title: "Pick a goal",
        body: "Scout finds the videos and reading for it.",
    },
    {
        to: "/create",
        icon: Create,
        title: "Bring a roadmap",
        body: "Paste notes or links you already have.",
    },
    {
        to: "/library",
        icon: Library,
        title: "Import a book",
        body: "Read an EPUB and keep highlights.",
    },
] as const;

/** Section heading row shared by each home panel: title, then a quiet link on the right. */
function SectionHead({
    title,
    link,
    trailing,
}: {
    title: string;
    link?: { to: string; label: string };
    trailing?: React.ReactNode;
}) {
    return (
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <h2 className="type-heading-sm">{title}</h2>
                {trailing}
            </CardTitle>
            {link && (
                <CardAction>
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link to={link.to} />}
                        nativeButton={false}
                    >
                        {link.label}
                    </Button>
                </CardAction>
            )}
        </CardHeader>
    );
}

type ReviewsData = ReturnType<typeof useReviews>;

/** Home once local records load: what to resume, the week so far, cards waiting and current books. */
function HomeContent({ reviews, roadmaps, records }: ReviewsData) {
    const positions = personalEntries(records, "study")
        .map((item) => item.data)
        .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    const recentRoadmap = positions
        .map((position) =>
            roadmaps.find((roadmap) => roadmap.id === position.roadmapId),
        )
        .find((roadmap) => roadmap && nextCoreItem(roadmap));
    const resumeRoadmap =
        recentRoadmap ?? roadmaps.find((roadmap) => nextCoreItem(roadmap));
    const ladder = resumeRoadmap ? getLadder(resumeRoadmap) : null;
    const resumeTask = resumeRoadmap ? nextCoreItem(resumeRoadmap) : null;
    const resumeLevel = ladder?.levels.find((level) =>
        level.items.some((entry) => entry.task.id === resumeTask?.task.id),
    );
    const levelUp = ladder ? levelUpReady(ladder) : null;
    const lastRoadmap =
        positions
            .map((position) =>
                roadmaps.find((roadmap) => roadmap.id === position.roadmapId),
            )
            .find((roadmap) => roadmap !== undefined) ??
        [...roadmaps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
        null;
    const video = resumeTask ? taskVideo(resumeTask) : null;
    const youtubeId = video ? getYouTubeId(video.url) : null;
    const studyEntry =
        resumeRoadmap && resumeTask
            ? records[`study:${resumeRoadmap.id}:${resumeTask.task.id}`]
            : undefined;
    const seconds =
        video &&
        studyEntry?.kind === "study" &&
        studyEntry.data.resourceUrl === video.url
            ? studyEntry.data.seconds
            : video
              ? getVideoStartSeconds(video.url)
              : 0;
    const books = personalEntries(records, "book")
        .map((item) => item.data)
        .filter((book) => book.status === "reading")
        .sort((a, b) =>
            (b.lastReadAt ?? b.addedAt).localeCompare(
                a.lastReadAt ?? a.addedAt,
            ),
        )
        .slice(0, 3);
    const record = normalizeLearningRecord(getStorage().getLearningRecord());
    const week = recentActivity(record);
    const weekTotal = week.reduce((total, day) => total + day.count, 0);
    const scheduled = reviews.filter(isScheduled);
    const dueCount = scheduled.filter((item) => isDue(item)).length;
    const nextDue = scheduled
        .filter((item) => !isDue(item))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .at(0);
    const noteCount = collectNotes(records, roadmaps).length;

    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                <Card>
                        <SectionHead
                            title="Continue learning"
                            trailing={
                                recentRoadmap ? (
                                    <span className="type-caption text-text-2">
                                        Last studied
                                    </span>
                                ) : undefined
                            }
                        />
                        <CardContent>
                            {resumeTask && resumeRoadmap ? (
                                <>
                                    <div className="flex flex-col gap-4 sm:flex-row">
                                        {youtubeId && (
                                            <Link
                                                className="relative block aspect-16/9 w-full shrink-0 overflow-hidden rounded-panel bg-field sm:w-48"
                                                to="/learn"
                                                search={{
                                                    roadmap: resumeRoadmap.id,
                                                    task: resumeTask.task.id,
                                                }}
                                                aria-label={`Continue ${resumeTask.task.title}`}
                                            >
                                                <img
                                                    src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
                                                    alt=""
                                                    className="size-full object-cover"
                                                />
                                                <span className="absolute inset-0 grid place-items-center">
                                                    <span className="grid size-8 place-items-center rounded-pill bg-ink text-text-inverse">
                                                        <Icon
                                                            icon={Play}
                                                            size={16}
                                                        />
                                                    </span>
                                                </span>
                                            </Link>
                                        )}
                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <p className="flex flex-wrap items-center gap-2 type-body-sm text-text-2">
                                                {resumeRoadmap.title}
                                                {levelUp && (
                                                    <Badge>
                                                        Level up:{" "}
                                                        {LEVEL_LABEL[levelUp.to]}
                                                    </Badge>
                                                )}
                                            </p>
                                            <h3 className="mt-1 type-heading-sm">
                                                {resumeTask.task.title ||
                                                    resumeTask.task.text}
                                            </h3>
                                            <p className="mt-1 type-body-sm text-text-2">
                                                {resumeLevel
                                                    ? `${LEVEL_LABEL[resumeLevel.level]} · core ${resumeLevel.coreDone + 1} of ${resumeLevel.coreTotal}`
                                                    : resumeTask.sectionTitle}
                                                {video && seconds > 0 && (
                                                    <>
                                                        {" · resume at "}
                                                        {formatTimestamp(
                                                            seconds,
                                                        )}
                                                    </>
                                                )}
                                            </p>
                                            <div className="mt-3">
                                                <Button
                                                    render={
                                                        <Link
                                                            to="/learn"
                                                            search={{
                                                                roadmap: resumeRoadmap.id,
                                                                task: resumeTask
                                                                    .task.id,
                                                            }}
                                                        />
                                                    }
                                                    nativeButton={false}
                                                >
                                                    Resume{" "}
                                                    {video
                                                        ? "lesson"
                                                        : "learning"}
                                                    <Icon icon={ArrowRight} />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    {(resumeTask.task.description ||
                                        resumeTask.task.estimatedTime) && (
                                        <p className="mt-3 type-body-sm text-text-2">
                                            {resumeTask.task.description ||
                                                resumeTask.task.estimatedTime}
                                        </p>
                                    )}
                                </>
                            ) : roadmaps.length > 0 ? (
                                <Empty variant="plain" reason="empty">
                                    <EmptyHeader>
                                        <EmptyTitle>
                                            Every core video is watched
                                        </EmptyTitle>
                                    </EmptyHeader>
                                    {lastRoadmap && (
                                        <EmptyContent>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                render={
                                                    <Link
                                                        to="/learn"
                                                        search={{
                                                            roadmap: lastRoadmap.id,
                                                        }}
                                                    />
                                                }
                                                nativeButton={false}
                                            >
                                                Go deeper
                                                <Icon icon={ArrowRight} />
                                            </Button>
                                        </EmptyContent>
                                    )}
                                </Empty>
                            ) : (
                                <ItemGroup
                                    variant="plain"
                                    aria-label="Get started"
                                >
                                    {STARTERS.map(
                                        (
                                            { to, icon: glyph, title, body },
                                            index,
                                        ) => (
                                            <Item key={to}>
                                                <ItemMedia variant="icon">
                                                    <Icon icon={glyph} />
                                                </ItemMedia>
                                                <ItemContent>
                                                    <ItemTitle>
                                                        <ItemLink
                                                            render={
                                                                <Link to={to} />
                                                            }
                                                        >
                                                            {title}
                                                        </ItemLink>
                                                    </ItemTitle>
                                                    <ItemDescription>
                                                        {body}
                                                    </ItemDescription>
                                                </ItemContent>
                                                <ItemMeta>{index + 1}</ItemMeta>
                                            </Item>
                                        ),
                                    )}
                                </ItemGroup>
                            )}
                        </CardContent>
                    </Card>
                <Card>
                        <SectionHead
                            title="Your learning topics"
                            link={{ to: "/workspaces", label: "View all" }}
                        />
                        {roadmaps.length ? (
                            <CardContent flush>
                            <ItemGroup
                                variant="plain"
                                aria-label="Your learning topics"
                            >
                                {roadmaps.slice(0, 5).map((roadmap) => {
                                    const topicLadder = getLadder(roadmap);
                                    const currentLevel = topicLadder.levels.find(
                                        (level) =>
                                            level.level === topicLadder.current,
                                    );
                                    const done = currentLevel
                                        ? currentLevel.coreDone
                                        : topicLadder.levels.reduce(
                                              (total, level) =>
                                                  total + level.coreDone,
                                              0,
                                          );
                                    const total = currentLevel
                                        ? currentLevel.coreTotal
                                        : topicLadder.levels.reduce(
                                              (total, level) =>
                                                  total + level.coreTotal,
                                              0,
                                          );
                                    return (
                                        <Item key={roadmap.id}>
                                            <ItemContent>
                                                <ItemTitle>
                                                    <ItemLink
                                                        render={
                                                            <Link
                                                                to="/learn"
                                                                search={{
                                                                    roadmap: roadmap.id,
                                                                }}
                                                            />
                                                        }
                                                    >
                                                        {roadmap.title}
                                                    </ItemLink>
                                                </ItemTitle>
                                                <ItemDescription>
                                                    {currentLevel
                                                        ? `${LEVEL_LABEL[currentLevel.level]} · ${currentLevel.coreDone}/${currentLevel.coreTotal} core`
                                                        : topicLadder.levels
                                                              .length
                                                          ? "Ladder complete"
                                                          : "Ready to explore"}
                                                </ItemDescription>
                                                <Progress
                                                    mode="meter"
                                                    size="sm"
                                                    className="mt-1.5 max-w-56"
                                                    value={done}
                                                    max={Math.max(1, total)}
                                                    warnAt={null}
                                                    failAt={null}
                                                    aria-label={`${roadmap.title} progress`}
                                                />
                                            </ItemContent>
                                            <ItemMeta>
                                                {done}/{total}
                                            </ItemMeta>
                                            <ItemActions>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label={`Open ${roadmap.title}`}
                                                    render={
                                                        <Link
                                                            to="/learn"
                                                            search={{
                                                                roadmap: roadmap.id,
                                                            }}
                                                        />
                                                    }
                                                    nativeButton={false}
                                                >
                                                    <Icon icon={ArrowRight} />
                                                </Button>
                                            </ItemActions>
                                        </Item>
                                    );
                                })}
                            </ItemGroup>
                            </CardContent>
                        ) : (
                            <CardContent>
                                <Empty variant="plain" reason="empty">
                                    <EmptyHeader>
                                        <EmptyTitle>
                                            Topics you start appear here
                                        </EmptyTitle>
                                    </EmptyHeader>
                                </Empty>
                            </CardContent>
                        )}
                    </Card>
            </div>
            <aside className="flex min-w-0 flex-col gap-4">
                <Card>
                        <SectionHead
                            title="This week"
                            link={{ to: "/progress", label: "Progress" }}
                        />
                        <CardContent>
                            <DataList variant="plain">
                                <DataListItem>
                                    <DataListLabel>Day streak</DataListLabel>
                                    <DataListValue>
                                        {record.currentStreak}
                                    </DataListValue>
                                </DataListItem>
                                <DataListItem>
                                    <DataListLabel>Lessons</DataListLabel>
                                    <DataListValue>{weekTotal}</DataListValue>
                                </DataListItem>
                                <DataListItem>
                                    <DataListLabel>Notes</DataListLabel>
                                    <DataListValue>
                                        <Link to="/notes">{noteCount}</Link>
                                    </DataListValue>
                                </DataListItem>
                            </DataList>
                            <Chart
                                type="sparkline"
                                label="Lessons finished on each of the last 7 days"
                                data={week.map((day) => day.count)}
                                unit="count"
                                className="mt-4 w-full"
                            />
                        </CardContent>
                    </Card>
                <Card>
                        <SectionHead
                            title="Reviews"
                            link={{ to: "/glossary", label: "Glossary" }}
                        />
                        <CardContent>
                            <p className="type-heading-sm">
                                {dueCount}{" "}
                                {dueCount === 1 ? "card ready" : "cards ready"}
                            </p>
                            <p className="mt-1 type-body-sm text-text-2">
                                {dueCount > 0
                                    ? `${scheduled.length} in your deck`
                                    : nextDue
                                      ? `Next in ${formatInterval(nextDue.dueAt)}`
                                      : "Keep a concept to start a deck"}
                            </p>
                            <div className="mt-3">
                                <Button
                                    variant={
                                        dueCount > 0 && !resumeTask
                                            ? "primary"
                                            : "secondary"
                                    }
                                    render={<Link to="/reviews" />}
                                    nativeButton={false}
                                    aria-label={`${dueCount} review cards ready`}
                                >
                                    Review
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                <Card>
                        <SectionHead
                            title="Currently reading"
                            link={{ to: "/library", label: "Library" }}
                        />
                        {books.length ? (
                            <CardContent flush>
                            <ItemGroup
                                variant="plain"
                                aria-label="Currently reading"
                            >
                                {books.map((book) => (
                                    <Item key={book.id}>
                                        <ItemMedia className="w-10">
                                            <BookCover
                                                book={book}
                                                className="w-full"
                                                compact
                                            />
                                        </ItemMedia>
                                        <ItemContent>
                                            <ItemTitle>
                                                <ItemLink
                                                    render={
                                                        <Link
                                                            to="/read/$id"
                                                            params={{
                                                                id: book.id,
                                                            }}
                                                        />
                                                    }
                                                >
                                                    {book.title}
                                                </ItemLink>
                                            </ItemTitle>
                                            <ItemDescription>
                                                {book.chapter}
                                            </ItemDescription>
                                            <Progress
                                                mode="meter"
                                                size="sm"
                                                className="mt-1.5 max-w-40"
                                                value={book.percent}
                                                max={100}
                                                warnAt={null}
                                                failAt={null}
                                                aria-label={`${book.title} progress`}
                                            />
                                        </ItemContent>
                                        <ItemActions>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                render={
                                                    <Link
                                                        to="/read/$id"
                                                        params={{ id: book.id }}
                                                    />
                                                }
                                                nativeButton={false}
                                            >
                                                Continue reading
                                            </Button>
                                        </ItemActions>
                                    </Item>
                                ))}
                            </ItemGroup>
                            </CardContent>
                        ) : (
                            <CardContent>
                                <Empty variant="plain" reason="empty">
                                    <EmptyHeader>
                                        <EmptyTitle>No book open</EmptyTitle>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            render={<Link to="/library" />}
                                            nativeButton={false}
                                        >
                                            Open Library
                                        </Button>
                                    </EmptyContent>
                                </Empty>
                            </CardContent>
                        )}
                    </Card>
            </aside>
        </div>
    );
}

/** The loading shape: the same panels in skeleton, so the page does not jump when data lands. */
function HomeSkeleton() {
    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                <Card>
                        <SectionHead title="Continue learning" />
                        <CardContent>
                            <Skeleton className="h-24" />
                        </CardContent>
                    </Card>
                <Card>
                        <SectionHead title="Your learning topics" />
                        <CardContent flush>
                        <ItemGroup
                            variant="plain"
                            aria-label="Your learning topics"
                        >
                            {[0, 1, 2].map((row) => (
                                <Item key={row}>
                                    <ItemContent>
                                        <ItemTitle>
                                            <SkeletonText type="label" />
                                        </ItemTitle>
                                        <ItemDescription>
                                            <SkeletonText
                                                type="body-sm"
                                                last={0.7}
                                            />
                                        </ItemDescription>
                                    </ItemContent>
                                </Item>
                            ))}
                        </ItemGroup>
                        </CardContent>
                    </Card>
            </div>
            <aside className="flex min-w-0 flex-col gap-4">
                <Card>
                        <SectionHead title="This week" />
                        <CardContent>
                            <Skeleton className="h-24" />
                        </CardContent>
                    </Card>
                <Card>
                        <SectionHead title="Reviews" />
                        <CardContent>
                            <Skeleton className="h-16" />
                        </CardContent>
                    </Card>
                <Card>
                        <SectionHead title="Currently reading" />
                        <CardContent>
                            <Skeleton className="h-16" />
                        </CardContent>
                    </Card>
            </aside>
        </div>
    );
}

/** Home: the new-goal action up top, then the loaded panels or their skeleton shapes. */
export default function HomePage() {
    const data = useReviews();
    return (
        <PageFrame
            title="Home"
            actions={
                <Button
                    variant="secondary"
                    render={<Link to="/scout" />}
                    nativeButton={false}
                >
                    <Icon icon={Scout} />
                    New learning goal
                </Button>
            }
        >
            <SkeletonSwap
                loading={!data.loaded}
                fallback={<HomeSkeleton />}
                label="Loading home"
            >
                {data.loaded ? <HomeContent {...data} /> : null}
            </SkeletonSwap>
        </PageFrame>
    );
}

"use client";

import { useState } from "react";
import type { VideoSection, Section } from "@/types";
import VideoPlayer from "@/components/shared/VideoPlayer";
import { Badge } from "@/components/glaze/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/glaze/ui/empty-state";
import { FileVideo, Icon } from "@/components/glaze/icon";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemLink,
    ItemMedia,
    ItemTitle,
} from "@/components/glaze/ui/item";

interface Props {
    section: VideoSection;
    onUpdate: (updater: (s: Section) => Section) => void;
}

export default function Videos({ section }: Props) {
    const [activeVideoId, setActiveVideoId] = useState<string>(
        section.data[0]?.id || ""
    );

    const activeVideo = section.data.find((v) => v.id === activeVideoId) || section.data[0];

    return (
        <div className="flex min-h-0 flex-col gap-4 lg:h-full">
            <div>
                <h2 className="type-heading">{section.title}</h2>
                <p className="mt-1 type-body-sm text-text-2">Distraction-free viewing experience.</p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
                {/* Main Player Area */}
                {activeVideo ? (
                    <div className="shell min-w-0 flex-1">
                        <div className="panel flex min-h-0 flex-col overflow-hidden">
                            <div className="relative aspect-16/9 w-full shrink-0 bg-page">
                                <VideoPlayer
                                    url={activeVideo.url}
                                    title={activeVideo.title}
                                    description={activeVideo.description}
                                />
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                <h3 className="type-heading-sm">{activeVideo.title}</h3>
                                <div className="mt-1 flex items-center gap-3">
                                    <Badge>Now playing</Badge>
                                    {activeVideo.duration ? (
                                        <span className="type-caption text-text-2">
                                            {activeVideo.duration}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="mt-2 type-body-sm text-text-2">
                                    {activeVideo.description || "No description provided."}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1">
                        <Empty className="h-full">
                            <EmptyHeader>
                                <Icon icon={FileVideo} size={20} />
                                <EmptyTitle>No videos available</EmptyTitle>
                                <EmptyDescription>
                                    Add videos to this playlist to watch them
                                    here.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    </div>
                )}

                {/* Playlist Sidebar */}
                <div className="shell w-full shrink-0 lg:w-80">
                    <div className="panel flex min-h-0 flex-col">
                        <div className="flex items-center justify-between border-b border-line-faint p-3">
                            <h3 className="type-heading-sm">Playlist</h3>
                            <Badge count={section.data.length} />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <ItemGroup variant="plain" aria-label="Playlist">
                                {section.data.map((video) => {
                                    const imgUrl =
                                        video.platform === "youtube" &&
                                        video.videoId
                                            ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`
                                            : null;
                                    return (
                                        <Item
                                            key={video.id}
                                            selected={video.id === activeVideoId}
                                        >
                                            {imgUrl ? (
                                                <ItemMedia>
                                                    {/* next/image is not practical here because thumbnail hosts are provider-controlled. */}
                                                    <img
                                                        src={imgUrl}
                                                        alt=""
                                                        className="aspect-16/9 h-full rounded-tag object-cover"
                                                    />
                                                </ItemMedia>
                                            ) : (
                                                <ItemMedia>
                                                    <Icon icon={FileVideo} />
                                                </ItemMedia>
                                            )}
                                            <ItemContent>
                                                <ItemTitle>
                                                    <ItemLink
                                                        href={video.url}
                                                        aria-current={video.id === activeVideoId ? "true" : undefined}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setActiveVideoId(video.id);
                                                        }}
                                                    >
                                                        {video.title}
                                                    </ItemLink>
                                                </ItemTitle>
                                                <ItemDescription>
                                                    {video.platform}
                                                    {video.duration
                                                        ? ` · ${video.duration}`
                                                        : ""}
                                                </ItemDescription>
                                            </ItemContent>
                                        </Item>
                                    );
                                })}
                            </ItemGroup>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

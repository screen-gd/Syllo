"use client";

import { useState } from "react";
import type { VideoSection, Section } from "@/types";
import VideoPlayer from "@/components/shared/VideoPlayer";

interface Props {
    section: VideoSection;
    onUpdate: (updater: (s: Section) => Section) => void;
}

export default function Videos({ section, onUpdate }: Props) {
    const [activeVideoId, setActiveVideoId] = useState<string>(
        section.data[0]?.id || ""
    );

    const activeVideo = section.data.find((v) => v.id === activeVideoId) || section.data[0];

    return (
        <div className="max-w-6xl mx-auto h-[max(calc(100vh-160px),600px)] flex flex-col animate-fade-in relative z-10">
            <div className="mb-6 shrink-0 text-center sm:text-left">
                <h2 className="font-display text-4xl font-black text-text-primary mb-2 drop-shadow-md flex items-center justify-center sm:justify-start gap-3">
                    <span className="text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">▶</span> {section.title}
                </h2>
                <p className="text-text-secondary text-sm">Distraction-free viewing experience.</p>
            </div>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
                {/* Main Player Area */}
                {activeVideo ? (
                    <div className="flex-1 flex flex-col min-h-0 group animate-slide-up rounded-2xl overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] border border-border-subtle bg-obsidian">
                        <div className="relative w-full aspect-video bg-black flex-shrink-0">
                            <VideoPlayer
                                url={activeVideo.url}
                                title={activeVideo.title}
                                description={activeVideo.description}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gradient-to-b from-obsidian-surface to-obsidian">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="bg-indigo-500/20 text-indigo-300 text-[12px] font-bold uppercase tracking-widest px-2.5 py-1 rounded shadow-[0_0_10px_rgba(99,102,241,0.2)]">Now Playing</span>
                                {activeVideo.duration && <span className="text-text-secondary text-sm tabular-nums">⏱ {activeVideo.duration}</span>}
                            </div>
                            <h3 className="font-display text-2xl font-bold text-text-primary text-text-primary mb-4">{activeVideo.title}</h3>
                            <p className="text-text-secondary leading-relaxed bg-obsidian-elevated/30 p-4 rounded-xl border border-border">
                                {activeVideo.description || "No description provided."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center surface rounded-2xl border-border border-dashed border">
                        <div className="text-center">
                            <div className="text-4xl mb-4">🎥</div>
                            <h3 className="text-lg font-bold text-text-primary text-text-primary">No videos available</h3>
                            <p className="text-sm text-text-secondary mt-2">Add videos to this playlist to watch them here.</p>
                        </div>
                    </div>
                )}

                {/* Playlist Sidebar */}
                <div className="w-full lg:w-96 shrink-0 flex flex-col min-h-0 surface rounded-2xl border border-border overflow-hidden shadow-xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="p-4 border-b border-border/50 bg-obsidian-surface/80 backdrop-blur-sm shrink-0 flex items-center justify-between">
                        <h3 className="font-display font-bold text-text-primary text-sm text-text-secondary uppercase tracking-widest">Playlist</h3>
                        <span className="text-[12px] bg-white/5 px-2 py-0.5 rounded text-text-secondary">{section.data.length} items</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-obsidian/30">
                        {section.data.map((video) => {
                            const isActive = video.id === activeVideoId;
                            const pseudoProgress = (video.id.length * 7) % 100; // Deterministic visual mock progress

                            const imgUrl = video.platform === "youtube" && video.videoId
                                ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`
                                : null;

                            return (
                                <button
                                    key={video.id}
                                    type="button"
                                    className={`w-full flex gap-3 p-3 rounded-xl text-left transition-all duration-300 relative group overflow-hidden ${isActive
                                        ? "bg-indigo-500/10 border border-indigo-500/20 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]"
                                        : "hover:bg-obsidian-surface border border-transparent hover:border-border"
                                        }`}
                                    onClick={() => setActiveVideoId(video.id)}
                                >
                                    <div className={`relative w-28 aspect-video rounded-lg shrink-0 overflow-hidden bg-obsidian-elevated flex items-center justify-center transition-transform duration-500 ${isActive ? 'ring-1 ring-indigo-400' : 'group-hover:scale-105'}`}>
                                        {imgUrl ? (
                                            <>
                                                {/* next/image is not practical here because thumbnail hosts are provider-controlled. */}
                                                <img src={imgUrl} alt={video.title} className="absolute inset-0 w-full h-full object-cover" />
                                            </>
                                        ) : (
                                            <span className="text-xl">🎥</span>
                                        )}
                                        {/* Duration Tag */}
                                        {video.duration && (
                                            <div className="absolute bottom-1 right-1 bg-black/80 font-mono text-xs text-white px-1 rounded backdrop-blur">
                                                {video.duration}
                                            </div>
                                        )}
                                        {/* Active Overlay */}
                                        {isActive && (
                                            <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center backdrop-blur-[2px]">
                                                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center drop-shadow-md">
                                                    <span className="text-white text-[12px] ml-0.5">▶</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col py-0.5 justify-between">
                                        <div>
                                            <span className={`text-sm font-bold line-clamp-2 leading-snug transition-colors ${isActive ? 'text-indigo-300' : 'text-text-primary group-hover:text-indigo-100'}`}>
                                                {video.title}
                                            </span>
                                            <span className="text-[12px] uppercase tracking-wider text-text-secondary mt-1 block">
                                                {video.platform}
                                            </span>
                                        </div>

                                        {/* Visual Mock Progress Bar */}
                                        <div className="w-full h-1 bg-black/50 overflow-hidden rounded-full mt-2">
                                            {pseudoProgress > 0 && (
                                                <div className={`h-full bg-indigo-500/80 rounded-full transition-all duration-1000`} style={{ width: `${pseudoProgress}%` }} />
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

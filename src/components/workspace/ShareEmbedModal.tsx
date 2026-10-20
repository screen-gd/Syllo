"use client";

import { useMemo, useState } from "react";
import { Code, Copy, Download, ExternalLink, Globe2, Loader2, Lock, X } from "lucide-react";
import type { Roadmap } from "@/types";

interface ShareEmbedModalProps {
    roadmap: Roadmap;
    isOpen: boolean;
    onClose: () => void;
    onUpdateRoadmap?: (updates: Partial<Roadmap>) => void;
}

export default function ShareEmbedModal({ roadmap, isOpen, onClose, onUpdateRoadmap }: ShareEmbedModalProps) {
    const [activeTab, setActiveTab] = useState<"share" | "embed" | "export">("share");
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedEmbed, setCopiedEmbed] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishMessage, setPublishMessage] = useState<string | null>(null);
    const shareUrl = useMemo(
        () => (typeof window !== "undefined" ? `${window.location.origin}/share/${roadmap.id}` : ""),
        [roadmap.id],
    );
    const embedUrl = useMemo(
        () => (typeof window !== "undefined" ? `${window.location.origin}/embed/${roadmap.id}` : ""),
        [roadmap.id],
    );
    const embedCode = `<iframe src="${embedUrl}" width="100%" height="800px" frameborder="0"></iframe>`;
    const isSyncedAccount = false;
    const isShareable = Boolean(roadmap.isPublic);

    if (!isOpen) return null;

    const handleCopy = (text: string, type: "link" | "embed") => {
        navigator.clipboard.writeText(text);
        if (type === "link") {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } else {
            setCopiedEmbed(true);
            setTimeout(() => setCopiedEmbed(false), 2000);
        }
    };

    const handleExportJSON = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(roadmap, null, 2));
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${roadmap.title.replace(/\s+/g, "_").toLowerCase()}_workspace.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleExportMD = () => {
        const mdContent = `# ${roadmap.title}\n\n${roadmap.summary || ""}\n\n${roadmap.sections.map((section) => `## ${section.title}\n${JSON.stringify(section.data, null, 2)}`).join("\n\n")}`;
        const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${roadmap.title.replace(/\s+/g, "_").toLowerCase()}_workspace.md`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleVisibilityChange = async (nextVisibility: boolean) => {
        if (!isSyncedAccount) {
            setPublishMessage("Share links require a synced account. The studio is local-only, so publishing is not available.");
            return;
        }

        setIsPublishing(true);
        setPublishMessage(null);

        try {
            const response = await fetch("/api/gallery/set-public", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId: roadmap.id,
                    isPublic: nextVisibility,
                    roadmap,
                }),
            });

            const payload = await response.json().catch(() => ({ success: false }));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error ?? "Failed to update sharing state");
            }

            onUpdateRoadmap?.({ isPublic: nextVisibility });
            setPublishMessage(
                nextVisibility
                    ? "This workspace is now public. The share and embed links are live."
                    : "This workspace is private again. Existing public links will stop working."
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update sharing state";
            setPublishMessage(message);
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border-subtle bg-obsidian-elevated shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <h2 className="font-display text-xl text-white">Share & Embed</h2>
                    <button onClick={onClose} className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-white/5 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex border-b border-border">
                    {[
                        { id: "share", label: "Shareable Link" },
                        { id: "embed", label: "Embed Code" },
                        { id: "export", label: "Export" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex-1 border-b-2 px-4 py-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                                activeTab === tab.id
                                    ? "border-indigo-500 bg-indigo-500/5 text-indigo-400"
                                    : "border-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {activeTab === "share" ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h3 className="mb-2 font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary">Read-only link</h3>
                                {isShareable ? (
                                    <>
                                        <p className="mb-4 text-sm text-text-secondary">
                                            Share this unique URL. Visitors will see the full workspace, track their own progress locally, but cannot edit your original content.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 overflow-x-auto truncate rounded-lg border border-border-subtle bg-obsidian-surface px-4 py-3 font-mono text-sm text-white">
                                                {shareUrl}
                                            </div>
                                            <button
                                                onClick={() => handleCopy(shareUrl, "link")}
                                                className="flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white transition-colors hover:bg-indigo-500"
                                            >
                                                <Copy size={16} />
                                                {copiedLink ? "Copied!" : "Copy Link"}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-xl border border-border-subtle bg-obsidian-surface px-4 py-4 text-sm text-text-secondary">
                                        <div className="flex items-start gap-3">
                                            {isSyncedAccount ? <Globe2 size={18} className="mt-0.5 text-indigo-300" /> : <Lock size={18} className="mt-0.5 text-amber-300" />}
                                            <div className="space-y-3">
                                                <p>
                                                    {isSyncedAccount
                                                        ? "This workspace is still private. Publish it once, then the share link and embed preview will become available."
                                                        : "Share links require a synced account. The studio is local-only, so publishing is not available."}
                                                </p>
                                                {isSyncedAccount ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleVisibilityChange(true)}
                                                        disabled={isPublishing}
                                                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
                                                    >
                                                        {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Globe2 size={16} />}
                                                        Make public
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {publishMessage ? (
                                <div className="rounded-xl border border-border-subtle bg-obsidian-surface px-4 py-4 text-sm text-text-secondary">
                                    {publishMessage}
                                </div>
                            ) : null}

                            {isShareable ? (
                                <div className="space-y-3">
                                    {isSyncedAccount ? (
                                        <button
                                            type="button"
                                            onClick={() => void handleVisibilityChange(false)}
                                            disabled={isPublishing}
                                            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 font-bold text-text-primary transition-colors hover:bg-white/5 disabled:opacity-60"
                                        >
                                            {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                                            Make private
                                        </button>
                                    ) : null}

                                    <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-400/90">
                                        <ExternalLink size={20} className="mt-0.5 shrink-0" />
                                        <div>
                                            <strong className="mb-1 block font-bold text-amber-400">Testing the link</strong>
                                            Try opening the link in an Incognito window to see exactly what your users will experience.
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {activeTab === "embed" ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {isShareable ? (
                                <>
                                    <div>
                                        <h3 className="mb-2 font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary">iframe HTML</h3>
                                        <p className="mb-4 text-sm text-text-secondary">
                                            Embed this workspace on your own website, Notion, or LMS (like Kajabi or Teachable).
                                        </p>
                                        <div className="flex items-start gap-2">
                                            <div className="flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border-subtle bg-obsidian-surface p-4 font-mono text-xs text-indigo-200">
                                                {embedCode}
                                            </div>
                                            <button
                                                onClick={() => handleCopy(embedCode, "embed")}
                                                className="flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white transition-colors hover:bg-indigo-500"
                                            >
                                                <Code size={16} />
                                                {copiedEmbed ? "Copied!" : "Copy Code"}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="mb-3 font-sans-display text-xs uppercase tracking-[0.2em] text-text-secondary">Live Preview</h3>
                                        <div className="relative h-64 overflow-hidden rounded-xl border border-border-subtle bg-obsidian">
                                            <iframe src={embedUrl} className="h-full w-full border-0 pointer-events-none" />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-xl border border-border-subtle bg-obsidian-surface px-4 py-4 text-sm text-text-secondary">
                                    Publish the workspace first to generate a working embed snippet.
                                </div>
                            )}
                        </div>
                    ) : null}

                    {activeTab === "export" ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <p className="mb-6 text-sm text-text-secondary">
                                Download your workspace content to use elsewhere or backup.
                            </p>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <button
                                    onClick={handleExportMD}
                                    className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-obsidian-surface/30 p-8 text-center transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5"
                                >
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 transition-transform group-hover:scale-110">
                                        <Download size={24} />
                                    </div>
                                    <span className="mb-1 font-display text-lg text-white">Markdown (.md)</span>
                                    <span className="text-[12px] text-text-secondary">Clean text format for Notion, Obsidian, or GitHub</span>
                                </button>

                                <button
                                    onClick={handleExportJSON}
                                    className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-obsidian-surface/30 p-8 text-center transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5"
                                >
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 transition-transform group-hover:scale-110">
                                        <Code size={24} />
                                    </div>
                                    <span className="mb-1 font-display text-lg text-white">Raw Data (.json)</span>
                                    <span className="text-[12px] text-text-secondary">Structured data for developers or backup</span>
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

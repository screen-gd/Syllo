import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import type { Roadmap } from "@/types";

export function EmbedView({ roadmap }: { roadmap: Roadmap | null }) {
    if (!roadmap) {
        return (
            <div className="flex h-screen items-center justify-center bg-obsidian px-6 text-center text-text-primary">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
                    <p className="text-[11px] font-sans-display uppercase tracking-[0.28em] text-text-secondary">
                        Embed unavailable
                    </p>
                    <p className="mt-3 text-sm text-text-secondary">
                        This workspace is private or no longer exists.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen overflow-hidden bg-obsidian text-text-primary">
            <WorkspaceShell roadmap={roadmap} isEmbed isReadOnly />
        </div>
    );
}

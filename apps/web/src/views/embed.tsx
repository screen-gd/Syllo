import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import type { Roadmap } from "@/types";

export function EmbedView({ roadmap }: { roadmap: Roadmap | null }) {
    if (!roadmap) {
        return (
            <div className="flex h-screen items-center justify-center bg-page px-6 text-center text-text">
                <div className="rounded-[24px] border border-border bg-text px-6 py-8">
                    <p className="text-xs font-display text-text-muted">
                        Embed unavailable
                    </p>
                    <p className="mt-3 text-sm text-text-muted">
                        This workspace is private or no longer exists.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen overflow-hidden bg-page text-text">
            <WorkspaceShell roadmap={roadmap} isEmbed isReadOnly />
        </div>
    );
}

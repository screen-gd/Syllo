import Header from "@/components/layout/Header";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import type { Roadmap } from "@/types";

export function ShareView({ roadmap }: { roadmap: Roadmap | null }) {
    if (!roadmap) {
        return (
            <div className="min-h-screen bg-page text-text">
                <Header />
                <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 pt-24">
                    <div className="rounded-[28px] border border-border bg-text p-10 text-center">
                        <p className="text-xs font-display text-text-muted">
                            Shared workspace
                        </p>
                        <h1 className="mt-4 font-display text-4xl text-text">Workspace not found</h1>
                        <p className="mt-3 max-w-xl text-sm text-text-muted">
                            This share link is unavailable or no longer public.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-page text-text">
            <Header />
            <main className="pt-20">
                <WorkspaceShell roadmap={roadmap} isReadOnly />
            </main>
        </div>
    );
}

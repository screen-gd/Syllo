import Header from "@/components/layout/Header";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import type { Roadmap } from "@/types";

export function ShareView({ roadmap }: { roadmap: Roadmap | null }) {
    if (!roadmap) {
        return (
            <div className="min-h-screen bg-obsidian text-text-primary">
                <Header />
                <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 pt-24">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
                        <p className="text-[11px] font-sans-display uppercase tracking-[0.3em] text-text-secondary">
                            Shared workspace
                        </p>
                        <h1 className="mt-4 font-display text-4xl text-white">Workspace not found</h1>
                        <p className="mt-3 max-w-xl text-sm text-text-secondary">
                            This share link is unavailable or no longer public.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-obsidian text-text-primary">
            <Header />
            <main className="pt-20">
                <WorkspaceShell roadmap={roadmap} isReadOnly />
            </main>
        </div>
    );
}

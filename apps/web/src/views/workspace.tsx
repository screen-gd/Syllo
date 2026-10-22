import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Search, Settings, X } from "lucide-react";
import Header from "@/components/layout/Header";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { useRoadmap } from "@/hooks/useRoadmap";

export function WorkspaceView({ id }: { id: string }) {
    const { roadmap, updateSection, saveRoadmap } = useRoadmap(id);
    const [apiError, setApiError] = useState<{ message: string } | null>(null);

    const handleApiError = (error: { message: string }) => {
        setApiError(error);
    };

    if (!roadmap) {
        return (
            <div className="min-h-full bg-[var(--color-page)]">
                <Header />
                <div className="page-shell flex min-h-[calc(100vh-4rem)] items-center justify-center pt-14">
                    <div className="max-w-md text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-border bg-[var(--color-surface)] text-text-muted">
                            <Search size={20} />
                        </div>
                        <h2 className="mt-6 text-3xl font-display tracking-[-0.03em] text-text">Workspace not found</h2>
                        <p className="mt-3 text-sm leading-7 text-text-muted">
                            This workspace does not exist anymore, or the link no longer points to saved content.
                        </p>
                        <div className="mt-6 flex justify-center">
                            <Link to="/workspaces" className="button-primary">
                                Back to library
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            {apiError ? (
                <div className="fixed left-0 right-0 top-0 z-[100] border-b border-[var(--color-danger)]/25 bg-[var(--color-danger)]/5 px-4 py-3">
                    <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 text-sm text-[var(--color-danger)]">
                        <AlertCircle size={18} />
                        <span>{apiError.message}</span>
                        <Link to="/settings" className="button-secondary !min-h-9">
                            <Settings size={12} />
                            Open settings
                        </Link>
                        <button type="button" onClick={() => setApiError(null)} className="text-[var(--color-danger)] transition-colors hover:opacity-80">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            ) : null}

            <WorkspaceShell
                roadmap={roadmap}
                onUpdateSection={updateSection}
                onUpdateRoadmap={(updates) => saveRoadmap({ ...roadmap, ...updates })}
                onApiError={handleApiError}
            />
        </div>
    );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Close, Failed, Settings } from "@/components/glaze/icon";
import { Icon } from "@/components/glaze/icon";
import { Button } from "@/components/glaze/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
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
            <div className="min-h-dvh bg-page" data-glaze>
                <Header />
                <div className="flex min-h-dvh items-center justify-center px-4">
                    <Empty reason="no-results">
                        <EmptyHeader>
                            <EmptyTitle>Workspace not found</EmptyTitle>
                            <EmptyDescription>
                                This workspace does not exist anymore, or the
                                link no longer points to saved content.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                render={<Link to="/workspaces" />}
                                nativeButton={false}
                            >
                                Back to library
                            </Button>
                        </EmptyContent>
                    </Empty>
                </div>
            </div>
        );
    }

    return (
        <div>
            {apiError ? (
                <div className="fixed inset-x-0 top-0 z-50 border-b border-line-faint bg-paper px-4 py-3">
                    <div className="mx-auto flex max-w-224 items-center justify-center gap-3 type-body-sm text-text-1">
                        <Icon icon={Failed} />
                        <span>{apiError.message}</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            render={<Link to="/settings" />}
                            nativeButton={false}
                        >
                            <Icon icon={Settings} />
                            Open settings
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Dismiss error"
                            onClick={() => setApiError(null)}
                        >
                            <Icon icon={Close} />
                        </Button>
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

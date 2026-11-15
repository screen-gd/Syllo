import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Close, Icon } from "@/components/glaze/icon";
import {
    Alert,
    AlertAction,
    AlertDescription,
} from "@/components/glaze/ui/alert";
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
            <div className="flex min-h-dvh flex-col bg-page">
                <Header />
                <main
                    id="main-content"
                    className="flex flex-1 items-center justify-center px-4 py-10"
                >
                    <h1 className="sr-only">Workspace not found</h1>
                    <Empty reason="no-results" className="w-full max-w-md">
                        <EmptyHeader>
                            <EmptyTitle>Workspace not found</EmptyTitle>
                            <EmptyDescription>
                                This workspace does not exist anymore, or the
                                link no longer points to saved content.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                variant="secondary"
                                size="sm"
                                render={<Link to="/workspaces" />}
                                nativeButton={false}
                            >
                                Back to learning topics
                            </Button>
                        </EmptyContent>
                    </Empty>
                </main>
            </div>
        );
    }

    return (
        <div>
            {apiError ? (
                <div className="fixed inset-x-0 top-0 z-(--z-overlay) mx-auto max-w-224 p-3">
                    <Alert status="fail">
                        <AlertDescription>{apiError.message}</AlertDescription>
                        <AlertAction>
                            <Button
                                variant="secondary"
                                size="sm"
                                render={<Link to="/settings" />}
                                nativeButton={false}
                            >
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
                        </AlertAction>
                    </Alert>
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

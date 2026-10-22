import type { Roadmap } from "@/types";
import { getWorkspacePersistence, type WorkspaceVersion } from "@/lib/workspace-persistence";

export type { WorkspaceVersion };

export function saveVersion(workspace: Roadmap) {
    return getWorkspacePersistence().saveVersion(workspace);
}

export function getVersions(workspaceId: string): WorkspaceVersion[] {
    if (typeof window === "undefined") return [];
    return getWorkspacePersistence().getVersions(workspaceId);
}

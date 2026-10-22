import type { StorageStatus } from "@/types";
import { getWorkspacePersistence, WORKSPACE_STATE_KEY } from "@/lib/workspace-persistence";

export { WORKSPACE_STATE_KEY as ROADMAPS_KEY };

export function getStorage() {
    return getWorkspacePersistence();
}

export function getRoadmapsBackupJson(): string {
    return getWorkspacePersistence().exportJson();
}

export async function getStorageStatus(): Promise<StorageStatus> {
    return { mode: "local-only", cloudAvailable: false, email: null };
}

import type { Roadmap } from "@/types";
import { getStoredRoadmap, listStoredRoadmaps, upsertStoredRoadmap } from "@/lib/server/store";

export async function listUserWorkspaces(): Promise<Roadmap[]> {
    return listStoredRoadmaps();
}

export async function upsertUserWorkspace(roadmap: Roadmap) {
    upsertStoredRoadmap(roadmap);
}

export async function getPublicWorkspace(id: string) {
    const roadmap = getStoredRoadmap(id);
    if (!roadmap?.isPublic) return null;
    return roadmap;
}

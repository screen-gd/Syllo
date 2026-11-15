"use client";

import { useState, useCallback, useEffect } from "react";
import type { Roadmap, Section } from "@/types";
import { getStorage } from "@/lib/storage";

export function useRoadmap(id?: string, isSession: boolean = false) {
    const storage = getStorage();

    // Storage lives in the browser, so both renders start empty and the mount effect reads it. Reading it in the
    // initializer served "not found" from the server and mismatched on hydration.
    const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
    const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Refresh roadmaps list from storage
    const refreshList = useCallback(() => {
        setRoadmaps(storage.getRoadmaps());
    }, [storage]);

    // Load a specific roadmap
    const loadRoadmap = useCallback((roadmapId: string) => {
        const r = storage.getRoadmap(roadmapId);
        setRoadmap(r);
        return r;
    }, [storage]);

    // Save a new or updated roadmap
    const saveRoadmap = useCallback((r: Roadmap) => {
        storage.saveRoadmap(r);
        setRoadmap(r);
        setRoadmaps(storage.getRoadmaps());
    }, [storage]);

    // Delete a roadmap
    const deleteRoadmap = useCallback((roadmapId: string) => {
        storage.deleteRoadmap(roadmapId);
        if (roadmap?.id === roadmapId) setRoadmap(null);
        setRoadmaps(storage.getRoadmaps());
    }, [roadmap?.id, storage]);

    // Update a specific section within the roadmap (functional setState: 5.9)
    const updateSection = useCallback(
        (sectionId: string, updater: (section: Section) => Section) => {
            setRoadmap((prev) => {
                if (!prev) return prev;
                const updated: Roadmap = {
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    sections: prev.sections.map((s) =>
                        s.id === sectionId ? updater(s) : s
                    ),
                };

                if (isSession) {
                    // Only save progress to session store
                    if (id) storage.saveSession(id, updated.sections);
                } else {
                    storage.saveRoadmap(updated);
                }
                return updated;
            });
        },
        [id, isSession, storage]
    );

    // Read storage on mount and whenever the id changes
    useEffect(() => {
        setRoadmap(id ? storage.getWorkspace(id, isSession) : null);
        setRoadmaps(storage.getRoadmaps());
        setLoaded(true);
    }, [id, isSession, storage]);

    return {
        loaded,
        roadmap,
        roadmaps,
        refreshList,
        loadRoadmap,
        saveRoadmap,
        deleteRoadmap,
        updateSection,
    };
}

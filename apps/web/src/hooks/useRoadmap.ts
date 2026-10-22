"use client";

import { useState, useCallback, useEffect } from "react";
import type { Roadmap, Section } from "@/types";
import { getStorage } from "@/lib/storage";

export function useRoadmap(id?: string, isSession: boolean = false) {
    const storage = getStorage();

    // Lazy state initialization (vercel best practice: 5.10)
    const [roadmap, setRoadmap] = useState<Roadmap | null>(() => {
        if (typeof window === "undefined" || !id) return null;
        return storage.getWorkspace(id, isSession);
    });

    const [roadmaps, setRoadmaps] = useState<Roadmap[]>(() => {
        if (typeof window === "undefined") return [];
        return storage.getRoadmaps();
    });

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

    // Sync on mount if id changes
    useEffect(() => {
        if (id) {
            setRoadmap(storage.getWorkspace(id, isSession));
        }
    }, [id, isSession, storage]);

    return {
        roadmap,
        roadmaps,
        refreshList,
        loadRoadmap,
        saveRoadmap,
        deleteRoadmap,
        updateSection,
    };
}

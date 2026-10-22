import { useEffect, useState } from "react";
import { getStorage } from "@/lib/storage";
import {
    WORKSPACE_CHANGE_EVENT,
    WORKSPACE_STATE_KEY,
} from "@/lib/workspace-persistence";
import type { Roadmap } from "@/types";

export function useLearningRoadmaps() {
    const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        function refresh() {
            setRoadmaps(getStorage().getRoadmaps());
            setLoaded(true);
        }
        const onStorage = (event: StorageEvent) => {
            if (event.key === WORKSPACE_STATE_KEY) refresh();
        };
        refresh();
        window.addEventListener(WORKSPACE_CHANGE_EVENT, refresh);
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener(WORKSPACE_CHANGE_EVENT, refresh);
            window.removeEventListener("storage", onStorage);
        };
    }, []);
    return { roadmaps, loaded };
}

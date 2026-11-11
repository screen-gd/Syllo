import { useMemo } from "react";
import { usePersonalData } from "@/lib/personal/store";
import { collectReviews } from "@/lib/reviews";
import { useLearningRoadmaps } from "./useLearningRoadmaps";

/** Every review card on this device, kept current as cards and roadmaps change. */
export function useReviews() {
    const { roadmaps, loaded } = useLearningRoadmaps();
    const records = usePersonalData();
    const reviews = useMemo(
        () => collectReviews(roadmaps, records),
        [roadmaps, records],
    );
    return { reviews, roadmaps, records, loaded };
}

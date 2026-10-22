import { useCallback, useEffect, useState } from "react";
import { addLearningTime } from "@/lib/learning-session";
import { getWorkspacePersistence } from "@/lib/workspace-persistence";

export function useTimeTracker(moduleId?: string) {
  const persistence = getWorkspacePersistence();
  const initial = persistence.getLearningRecord();
  const [sessionTimeMs, setSessionTimeMs] = useState(initial.sessionTimeMs);
  const [moduleTimeMs, setModuleTimeMs] = useState(moduleId ? initial.moduleTimeMs[moduleId] ?? 0 : 0);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = addLearningTime(persistence.getLearningRecord(), moduleId, 1000);
      persistence.saveLearningRecord(next);
      setSessionTimeMs(next.sessionTimeMs);
      if (moduleId) setModuleTimeMs(next.moduleTimeMs[moduleId] ?? 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [moduleId, persistence]);

  const getModuleTime = useCallback((id: string) => persistence.getLearningRecord().moduleTimeMs[id] ?? 0, [persistence]);
  return { sessionTimeMs, moduleTimeMs, getModuleTime };
}

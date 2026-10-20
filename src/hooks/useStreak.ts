import { useCallback, useEffect, useState } from "react";
import { normalizeLearningRecord, recordTaskCompletion } from "@/lib/learning-session";
import { getWorkspacePersistence, type LearningRecord } from "@/lib/workspace-persistence";

export function useStreak() {
  const persistence = getWorkspacePersistence();
  const [record, setRecord] = useState<LearningRecord>(() => normalizeLearningRecord(persistence.getLearningRecord()));

  useEffect(() => { persistence.saveLearningRecord(record); }, [persistence, record]);

  const logActivity = useCallback((isTaskCompletion = false) => {
    if (isTaskCompletion) setRecord((current) => recordTaskCompletion(current));
  }, []);

  const today = new Date().toLocaleDateString("en-CA");
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA");
  const hasActedToday = record.lastActivityDate === today;

  return {
    currentStreak: record.currentStreak,
    tasksCompletedToday: record.tasksByDate[today] ?? 0,
    tasksCompletedYesterday: record.tasksByDate[yesterday] ?? 0,
    isAtRisk: record.currentStreak > 0 && !hasActedToday,
    hasActedToday,
    logActivity,
  };
}

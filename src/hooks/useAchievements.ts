import { useState, useEffect, useCallback } from 'react';
import { unlockLearningBadge } from '@/lib/learning-session';
import { getWorkspacePersistence } from '@/lib/workspace-persistence';

export type BadgeType = 
  | 'first_step'
  | 'on_a_roll'
  | 'deep_diver'
  | 'module_master'
  | 'speed_learner'
  | 'course_complete'
  | 'explorer';

export interface Badge {
  id: BadgeType;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}

export const BADGES_CONFIG: Record<BadgeType, Omit<Badge, 'id' | 'unlockedAt'>> = {
  first_step: { title: 'First Step', description: 'Complete your first task', icon: '🚀' },
  on_a_roll: { title: 'On A Roll', description: 'Complete tasks 3 days in a row', icon: '🔥' },
  deep_diver: { title: 'Deep Diver', description: 'Open 5 different resources in one session', icon: '📚' },
  module_master: { title: 'Module Master', description: 'Mark a full module complete', icon: '🎯' },
  speed_learner: { title: 'Speed Learner', description: 'Complete a module in under 24 hours', icon: '⚡' },
  course_complete: { title: 'Course Complete', description: 'Finish all modules in a workspace', icon: '🏆' },
  explorer: { title: 'Explorer', description: 'Create 3 or more workspaces', icon: '🗺️' },
};

export function useAchievements() {
  const [unlockedBadges, setUnlockedBadges] = useState<Record<string, number>>({});
  const [recentBadge, setRecentBadge] = useState<Badge | null>(null);

  useEffect(() => {
    setUnlockedBadges(getWorkspacePersistence().getLearningRecord().unlockedBadges);
  }, []);

  const unlockBadge = useCallback((badgeId: BadgeType) => {
    setUnlockedBadges((prev) => {
      if (prev[badgeId]) return prev;
      
      const persistence = getWorkspacePersistence();
      const record = unlockLearningBadge(persistence.getLearningRecord(), badgeId);
      const updated = record.unlockedBadges;
      persistence.saveLearningRecord(record);
      
      const badgeToToast: Badge = { id: badgeId, ...BADGES_CONFIG[badgeId], unlockedAt: updated[badgeId] };
      setRecentBadge(badgeToToast);
      
      setTimeout(() => setRecentBadge(null), 5000);
      
      return updated;
    });
  }, []);

  const clearRecentBadge = useCallback(() => setRecentBadge(null), []);

  const getBadges = useCallback((): Badge[] => {
    return Object.entries(BADGES_CONFIG).map(([id, config]) => ({
      id: id as BadgeType,
      ...config,
      unlockedAt: unlockedBadges[id as BadgeType],
    }));
  }, [unlockedBadges]);

  return { unlockedBadges, unlockBadge, recentBadge, clearRecentBadge, getBadges };
}

import type { PrivacySettings } from "@/types";
import { LOCAL_USER_ID } from "@/lib/server/store";
import {
    getStoredLedger,
    getStoredPrivacySettings,
    listStoredCoachingSessions,
    listStoredProgressSnapshots,
    listStoredRoadmaps,
    listStoredTransactions,
    resetServerStore,
    setStoredPrivacySettings,
    unpublishAllStoredRoadmaps,
} from "@/lib/server/store";

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
    anonymousAnalytics: false,
    allowPublicGallery: false,
};

export async function getPrivacySettings(): Promise<PrivacySettings> {
    return getStoredPrivacySettings() ?? DEFAULT_PRIVACY_SETTINGS;
}

export async function updatePrivacySettings(settings: PrivacySettings): Promise<PrivacySettings> {
    setStoredPrivacySettings(settings);

    if (!settings.allowPublicGallery) {
        unpublishAllStoredRoadmaps();
    }

    return settings;
}

export async function exportUserData() {
    const roadmaps = listStoredRoadmaps();
    const privacySettings = getStoredPrivacySettings();

    return {
        exportedAt: new Date().toISOString(),
        userId: LOCAL_USER_ID,
        roadmaps,
        srsItems: [],
        creditLedger: getStoredLedger(LOCAL_USER_ID) ?? null,
        creditTransactions: listStoredTransactions(Number.MAX_SAFE_INTEGER),
        progressSnapshots: listStoredProgressSnapshots(),
        coachingSessions: listStoredCoachingSessions(),
        privacySettings,
        notes: [],
    };
}

export async function deleteAllUserData() {
    resetServerStore();
    return { success: true };
}

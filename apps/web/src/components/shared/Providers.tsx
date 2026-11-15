"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "@/components/glaze/ui/toast";
import CloudSync from "@/components/sync/CloudSync";
import PomodoroProvider from "@/components/learning/Pomodoro";
import OfflineSupport from "@/components/learning/OfflineSupport";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <MotionConfig reducedMotion="user">
            <OfflineSupport />
            <CloudSync><PomodoroProvider>{children}</PomodoroProvider></CloudSync>
            <Toaster />
        </MotionConfig>
    );
}

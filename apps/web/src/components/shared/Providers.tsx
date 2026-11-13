"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import CloudSync from "@/components/sync/CloudSync";
import PomodoroProvider from "@/components/learning/Pomodoro";
import OfflineSupport from "@/components/learning/OfflineSupport";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <MotionConfig reducedMotion="user">
            <OfflineSupport />
            <CloudSync><PomodoroProvider>{children}</PomodoroProvider></CloudSync>
            <Toaster
                theme="light"
                position="bottom-right"
                toastOptions={{
                    unstyled: true,
                    classNames: {
                        toast:
"surface-panel flex items-start gap-3 px-4 py-3 text-sm text-text shadow-none",
                        title: "font-medium text-text",
                        description: "text-text-muted",
                        actionButton:
"button-primary h-8 min-h-8 px-3 text-xs",
                        cancelButton:
"button-secondary h-8 min-h-8 px-3 text-xs",
                        closeButton:
"text-text-soft transition hover:text-text",
                    },
                }}
            />
        </MotionConfig>
    );
}

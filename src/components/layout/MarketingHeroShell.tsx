"use client";

import type { ReactNode } from "react";

export default function MarketingHeroShell({ children }: { children: ReactNode }) {
    return (
        <div className="relative min-h-full bg-obsidian text-text-primary">
            <div className="pointer-events-none absolute inset-0 hero-mesh-gradient opacity-60" />
            <div className="pointer-events-none absolute inset-0 landing-grid-bg opacity-20" />
            <div className="relative z-10">{children}</div>
        </div>
    );
}

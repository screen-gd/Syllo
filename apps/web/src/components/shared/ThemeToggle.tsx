"use client";

import { Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            className="pointer-events-none rounded-full border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,var(--color-page))] text-[var(--color-text-muted)]"
            title="Light theme"
            aria-label="Light theme active"
        >
            <Sun className="h-4 w-4" />
        </Button>
    );
}

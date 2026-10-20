import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    icon: string;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-[color:color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))] text-text">
                {icon ? <span className="text-2xl">{icon}</span> : <Sparkles className="h-5 w-5" />}
            </div>
            <h3 className="mb-1 font-display text-lg font-bold text-text-primary">{title}</h3>
            <p className="text-text-secondary text-sm max-w-sm mb-4" style={{ textWrap: "balance" }}>
                {description}
            </p>
            {action ? (
                <Button type="button" variant="secondary" className="text-sm" onClick={action.onClick}>
                    {action.label}
                </Button>
            ) : null}
        </div>
    );
}

import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export default function ViralBadge() {
    return (
        <div className="fixed bottom-4 left-4 z-40 rounded-full bg-surface-muted px-4 py-2 text-xs font-medium text-text-muted">
            <Link to="/pricing" className="inline-flex items-center gap-2">
                <Sparkles size={13} />
                Remove ZNS branding on Pro
            </Link>
        </div>
    );
}

import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export default function ViralBadge() {
    return (
        <div className="fixed bottom-4 left-4 z-40 rounded-full border border-amber-300/20 bg-[linear-gradient(135deg,rgba(198,155,90,0.22),rgba(79,124,255,0.12))] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <Link to="/pricing" className="inline-flex items-center gap-2">
                <Sparkles size={13} className="text-amber-200" />
                Remove ZNS branding on Pro
            </Link>
        </div>
    );
}

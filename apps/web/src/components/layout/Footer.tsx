import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/shared/Logo";
import { PUBLIC_NAV_ITEMS } from "@/lib/navigation";

export default function Footer() {
    return (
        <footer className="relative z-10 overflow-hidden border-t border-border bg-page">
            <div className="page-shell-wide grid gap-8 py-10 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1fr)_auto] lg:items-end">
                <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center border border-border">
                        <Logo />
                    </span>
                    <div>
                        <p className="font-display text-2xl tracking-[-0.04em] text-text">Syllo</p>
                        <p className="text-xs text-text-soft">Personal learning and reading</p>
                    </div>
                </div>

                <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    {PUBLIC_NAV_ITEMS.map((link) => (
                        <Link
                            key={link.href}
                            to={link.href}
                            className="border-b border-transparent pb-1 text-[12px] font-semibold text-text-muted transition-colors hover:border-border hover:text-text"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <p className="text-xs text-text-soft">&copy; {new Date().getFullYear()}</p>
            </div>
        </footer>
    );
}

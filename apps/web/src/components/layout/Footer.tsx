import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/shared/Logo";
import { PUBLIC_NAV_ITEMS } from "@/lib/navigation";

export default function Footer() {
    return (
        <footer className="border-t border-line-faint bg-page">
            <div className="mx-auto w-full max-w-256 px-4 sm:px-6 flex flex-col gap-8 py-10 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex items-center gap-3">
                    <Logo />
                    <div>
                        <p className="type-heading-sm text-text-1">Syllo</p>
                        <p className="type-caption text-text-2">Personal learning and reading</p>
                    </div>
                </div>

                <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    {PUBLIC_NAV_ITEMS.map((link) => (
                        <Link
                            key={link.href}
                            to={link.href}
                            className="type-label-sm border-b border-transparent pb-1 text-text-2 transition-colors duration-(--dur-state) ease-out hover:border-line-faint hover:text-text-1"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <p className="type-caption text-text-2">&copy; {new Date().getFullYear()}</p>
            </div>
        </footer>
    );
}

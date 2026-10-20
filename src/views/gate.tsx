import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "@/lib/router-nav";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Sparkles } from "lucide-react";

function GateForm() {
    const searchParams = useSearchParams();
    const nextPath = searchParams.get("next") || "/";

    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
    const [error, setError] = useState("");

    useEffect(() => {
        if (status === "error") {
            const timer = setTimeout(() => setStatus("idle"), 4000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!password || status === "checking") {
            return;
        }
        setStatus("checking");
        setError("");
        try {
            const res = await fetch("/api/gate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                // A hard navigation guarantees the fresh gate cookie reaches
                // the server on the next request.
                window.location.assign(nextPath);
                return;
            }
            setStatus("error");
            setError("Incorrect password. Please try again.");
        } catch {
            setStatus("error");
            setError("Something went wrong. Please try again.");
        }
    }

    return (
        <div className="w-full max-w-md">
            <form
                onSubmit={handleSubmit}
                className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm"
            >
                <div className="mb-6 flex flex-col items-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-accent-soft)] ring-1 ring-[color:var(--color-accent)]/30">
                        <Lock className="h-6 w-6 text-[color:var(--color-accent)]" />
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight text-[color:var(--color-text)]">
                        Enter access password
                    </h2>
                    <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
                        This site is password-protected. Ask the owner for access.
                    </p>
                </div>

                <div className="relative">
                    <KeyRound
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-text-soft)]"
                        aria-hidden="true"
                    />
                    <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoFocus
                        autoComplete="current-password"
                        aria-label="Access password"
                        className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-12 text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-soft)] outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/30"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[color:var(--color-text-soft)] transition hover:text-[color:var(--color-text)]"
                    >
                        {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                        ) : (
                            <Eye className="h-4 w-4" />
                        )}
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={!password || status === "checking"}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--color-accent)] py-3 text-sm font-semibold text-black transition hover:bg-[color:var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {status === "checking" ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Unlocking…
                        </>
                    ) : (
                        "Unlock"
                    )}
                </button>

                {error && (
                    <p
                        role="alert"
                        className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400"
                    >
                        {error}
                    </p>
                )}
            </form>
        </div>
    );
}

function GateShell() {
    return (
        <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[color:var(--color-page)] px-6">
            {/* Ambient glow */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse 60% 45% at 50% -5%, rgba(16, 185, 129, 0.14), transparent 70%), radial-gradient(ellipse 50% 40% at 85% 110%, rgba(16, 185, 129, 0.08), transparent 70%)",
                }}
            />

            <div className="relative z-10 flex flex-col items-center text-center">
                <div className="mb-8 flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-[color:var(--color-accent)]" aria-hidden="true" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--color-text-muted)]">
                        Coming soon
                    </span>
                    <Sparkles className="h-5 w-5 text-[color:var(--color-accent)]" aria-hidden="true" />
                </div>

                <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-5xl">
                    Something is being built here.
                </h1>

                <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--color-text-muted)]">
                    This project is currently under{" "}
                    <span className="text-[color:var(--color-text)]">passive development</span> and will be
                    revealed soon. While the work is still in progress, access is limited to a small
                    circle of people.
                </p>

                <div className="mt-12 w-full">
                    <Suspense fallback={null}>
                        <GateForm />
                    </Suspense>
                </div>

                <p className="mt-10 text-xs text-[color:var(--color-text-soft)]">
                    Under construction · Details will be announced shortly
                </p>
            </div>
        </main>
    );
}

export default function GatePage() {
    return <GateShell />;
}

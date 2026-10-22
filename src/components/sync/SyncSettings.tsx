import { useState } from "react";
import { useCloudSync } from "./CloudSync";
import { personalEntries, usePersonalData } from "@/lib/personal/store";
import SettingsSection from "@/components/layout/SettingsSection";

export default function SyncSettings() {
    const sync = useCloudSync();
    const records = usePersonalData();
    const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <SettingsSection
            title="Books and progress sync"
            description="Continue reading and learning across your devices."
        >
            {sync.status === "local" ? (
                <>
                    <p>
                        Your data is saved on this device. Connect a free Convex
                        deployment to continue on your phone.
                    </p>
                    <p>
                        Setup instructions are in{" "}
                        <code>docs/syllo-setup.md</code>. No cloud account or
                        billing is required to use local mode.
                    </p>
                </>
            ) : sync.status === "connected" ? (
                <>
                    <p>
                        Your notes, reading positions, reviews, and learning
                        topics sync privately.
                    </p>
                    <div className="sy-card-actions">
                        <button
                            className="sy-button secondary"
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                setError(null);
                                try {
                                    for (const entry of personalEntries(
                                        records,
                                        "book",
                                    ))
                                        await sync.uploadBook(entry.data);
                                } catch (cause) {
                                    setError(
                                        cause instanceof Error
                                            ? cause.message
                                            : "Could not sync your books.",
                                    );
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            {busy
                                ? "Uploading…"
                                : "Upload books from this device"}
                        </button>
                        <button
                            className="sy-button quiet"
                            onClick={() => void sync.signOut?.()}
                        >
                            Sign out
                        </button>
                    </div>
                </>
            ) : sync.status === "connecting" ? (
                <p role="status">Connecting to your learning space…</p>
            ) : (
                <form
                    className="sy-form"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        setBusy(true);
                        setError(null);
                        const form = new FormData(event.currentTarget);
                        form.set("flow", flow);
                        try {
                            await sync.signIn?.(form);
                        } catch {
                            setError(
                                "Could not sign in. Check your credentials and the deployment’s owner email setting.",
                            );
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <label>
                        Email
                        <input
                            className="sy-input"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                        />
                    </label>
                    <label>
                        Password
                        <input
                            className="sy-input"
                            name="password"
                            type="password"
                            minLength={8}
                            autoComplete={
                                flow === "signIn"
                                    ? "current-password"
                                    : "new-password"
                            }
                            required
                        />
                    </label>
                    <div className="sy-card-actions">
                        <button className="sy-button primary" disabled={busy}>
                            {busy
                                ? "Connecting…"
                                : flow === "signIn"
                                  ? "Sign in"
                                  : "Create private account"}
                        </button>
                        <button
                            className="sy-button quiet"
                            type="button"
                            onClick={() =>
                                setFlow(flow === "signIn" ? "signUp" : "signIn")
                            }
                        >
                            {flow === "signIn"
                                ? "First time? Create account"
                                : "I already have an account"}
                        </button>
                    </div>
                </form>
            )}
            {(error || sync.error) && (
                <p className="sy-error" role="alert" style={{ marginTop: 16 }}>
                    {error || sync.error}
                </p>
            )}
        </SettingsSection>
    );
}

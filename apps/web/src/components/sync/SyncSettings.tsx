import { useState } from "react";
import { useCloudSync } from "./CloudSync";
import { personalEntries, usePersonalData } from "@/lib/personal/store";
import SettingsSection from "@/components/layout/SettingsSection";
import { Alert, AlertDescription } from "@/components/glaze/ui/alert";
import { Button } from "@/components/glaze/ui/button";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";

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
                    <p className="type-body-sm text-text-2">
                        Your data is saved on this device. Connect a free Convex
                        deployment to continue on your phone.
                    </p>
                    <p className="type-body-sm text-text-2">
                        Setup instructions are in{" "}
                        <code className="type-code-sm">docs/syllo-setup.md</code>
                        . No cloud account or billing is required to use local
                        mode.
                    </p>
                </>
            ) : sync.status === "connected" ? (
                <>
                    <p className="type-body-sm text-text-2">
                        Your notes, reading positions, reviews, and learning
                        topics sync privately.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="secondary"
                            pending={busy}
                            pendingLabel="Uploading"
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
                            Upload books from this device
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => void sync.signOut?.()}
                        >
                            Sign out
                        </Button>
                    </div>
                </>
            ) : sync.status === "connecting" ? (
                <p role="status" className="type-body-sm text-text-2">
                    Connecting to your learning space…
                </p>
            ) : (
                <form
                    className="grid gap-4"
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
                    <Field>
                        <FieldLabel>Email</FieldLabel>
                        <Input
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                        />
                    </Field>
                    <Field>
                        <FieldLabel>Password</FieldLabel>
                        <Input
                            mode="password"
                            name="password"
                            minLength={8}
                            autoComplete={
                                flow === "signIn"
                                    ? "current-password"
                                    : "new-password"
                            }
                            required
                        />
                    </Field>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="submit"
                            pending={busy}
                            pendingLabel="Connecting"
                        >
                            {flow === "signIn"
                                ? "Sign in"
                                : "Create private account"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                                setFlow(flow === "signIn" ? "signUp" : "signIn")
                            }
                        >
                            {flow === "signIn"
                                ? "First time? Create account"
                                : "I already have an account"}
                        </Button>
                    </div>
                </form>
            )}
            {(error || sync.error) && (
                <Alert status="fail">
                    <AlertDescription>{error || sync.error}</AlertDescription>
                </Alert>
            )}
        </SettingsSection>
    );
}

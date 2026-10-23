import { useEffect, useRef, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import SyncSettings from "@/components/sync/SyncSettings";
import SettingsSection from "@/components/layout/SettingsSection";
import {
    getPersonalSnapshot,
    mergePersonalEntries,
} from "@/lib/personal/store";
import { personalSnapshotSchema } from "@/lib/personal/schema";
import { getRoadmapsBackupJson } from "@/lib/storage";
import {
    DEFAULT_CONFIG,
    getUserConfig,
    saveUserConfig,
} from "@/lib/userConfig";
import { FREE_GEMINI_MODELS } from "@/lib/ai-policy";
import { scoutApi } from "@/lib/scout/api-client";
import type { ScoutAgentConnection } from "@/lib/scout/types";

export default function PersonalSettingsPage() {
    const [key, setKey] = useState("");
    const [model, setModel] = useState<string>(
        DEFAULT_CONFIG.modelByProvider.gemini,
    );
    const [showKey, setShowKey] = useState(false);
    const [connections, setConnections] = useState<
        ScoutAgentConnection[] | null
    >(null);
    const [error, setError] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const value = getUserConfig().modelByProvider.gemini;
        if (FREE_GEMINI_MODELS.some((model) => model === value))
            setModel(value);
    }, []);
    function exportData() {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            personal: getPersonalSnapshot(),
            legacyWorkspace: JSON.parse(getRoadmapsBackupJson()),
        };
        const url = URL.createObjectURL(
            new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
            }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `syllo-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }
    async function restore(file: File | undefined) {
        if (!file) return;
        try {
            if (file.size > 20 * 1024 * 1024)
                throw new Error("Choose a backup smaller than 20 MB.");
            const backup = z
                .object({ personal: personalSnapshotSchema })
                .parse(JSON.parse(await file.text()));
            mergePersonalEntries(Object.values(backup.personal));
            toast.success("Backup merged with this device’s data.");
            setError(null);
        } catch {
            setError(
                "Could not restore this backup. Your existing data is unchanged.",
            );
        }
    }
    return (
        <div className="sy-page">
            <header className="sy-page-head">
                <h1>Settings</h1>
            </header>
            <SettingsSection
                title="Free AI"
                description={
                    <>
                        Use a Gemini API key from an unbilled Google AI Studio
                        project. Syllo only allows free-eligible Flash models
                        and does not switch to paid providers. Free quotas
                        depend on your Google project.
                    </>
                }
            >
                <form
                    className="sy-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const config = getUserConfig();
                        saveUserConfig({
                            ...config,
                            provider: "gemini",
                            useCustomKey: true,
                            apiKeys: {
                                ...config.apiKeys,
                                gemini: key.trim() || config.apiKeys.gemini,
                            },
                            modelByProvider: {
                                ...config.modelByProvider,
                                gemini: model,
                            },
                        });
                        setKey("");
                        toast.success(
                            "Free Gemini configuration saved on this device.",
                        );
                    }}
                >
                    <label>
                        Gemini API key
                        <div style={{ display: "flex", gap: 10 }}>
                            <input
                                className="sy-input"
                                type={showKey ? "text" : "password"}
                                value={key}
                                onChange={(event) => setKey(event.target.value)}
                                placeholder="Leave blank to keep your saved key"
                                autoComplete="off"
                            />
                            <button
                                className="sy-button quiet"
                                type="button"
                                onClick={() => setShowKey((value) => !value)}
                            >
                                {showKey ? "Hide" : "Show"}
                            </button>
                        </div>
                        <span className="sy-form-hint">
                            Saved in this browser only. Keys are excluded from
                            cloud sync and backups.
                        </span>
                    </label>
                    <label>
                        Model
                        <select
                            className="sy-select"
                            value={model}
                            onChange={(event) => setModel(event.target.value)}
                        >
                            {FREE_GEMINI_MODELS.map((value) => (
                                <option key={value}>{value}</option>
                            ))}
                        </select>
                    </label>
                    <div className="sy-card-actions">
                        <button className="sy-button primary">
                            Save AI settings
                        </button>
                        <button
                            className="sy-button quiet"
                            type="button"
                            onClick={() => {
                                const config = getUserConfig();
                                saveUserConfig({
                                    ...config,
                                    provider: "gemini",
                                    useCustomKey: false,
                                    apiKeys: { ...config.apiKeys, gemini: "" },
                                });
                                setKey("");
                                toast.success(
                                    "Browser key removed. Server configuration will be used if available.",
                                );
                            }}
                        >
                            Remove browser key
                        </button>
                    </div>
                </form>
            </SettingsSection>
            <SyncSettings />
            <SettingsSection
                title="Your data"
                description={
                    <>
                        Export reading positions, highlights, notes, review
                        schedules, and roadmaps. EPUB files stay in your device
                        cache or private file storage; keep your original copies
                        too.
                    </>
                }
            >
                <div className="sy-card-actions">
                    <button
                        className="sy-button secondary"
                        onClick={exportData}
                    >
                        <Download />
                        Export backup
                    </button>
                    <button
                        className="sy-button quiet"
                        onClick={() => input.current?.click()}
                    >
                        Restore backup
                    </button>
                    <input
                        hidden
                        ref={input}
                        type="file"
                        accept=".json,application/json"
                        onChange={(event) => {
                            void restore(event.target.files?.[0]);
                            event.target.value = "";
                        }}
                    />
                </div>
            </SettingsSection>
            <SettingsSection
                title="Coding agents"
                description={
                    <>
                        Connect a local coding agent to Scout’s existing MCP
                        server. Imported resources remain suggestions until you
                        choose to use them.
                    </>
                }
            >
                <button
                    className="sy-button quiet"
                    onClick={async () => {
                        try {
                            setConnections(
                                (await scoutApi.getAgents()).connections,
                            );
                            setError(null);
                        } catch {
                            setError(
                                "Could not read local agent configurations. Start the local Syllo server and try again.",
                            );
                        }
                    }}
                >
                    Show connection settings
                </button>
                {connections?.map((connection) => (
                    <details key={connection.id} style={{ marginTop: 16 }}>
                        <summary>{connection.label}</summary>
                        <p className="sy-form-hint" style={{ marginTop: 8 }}>
                            {connection.note}
                        </p>
                        <pre className="sy-agent-snippet">
                            {connection.snippet}
                        </pre>
                        <button
                            className="sy-button quiet"
                            onClick={() => {
                                void navigator.clipboard
                                    .writeText(connection.snippet)
                                    .then(() =>
                                        toast.success("Copied configuration."),
                                    )
                                    .catch(() =>
                                        setError(
                                            "Select and copy the configuration manually.",
                                        ),
                                    );
                            }}
                        >
                            <Copy />
                            Copy
                        </button>
                    </details>
                ))}
            </SettingsSection>
            {error && (
                <p className="sy-error" role="alert" style={{ marginTop: 24 }}>
                    {error}
                </p>
            )}
        </div>
    );
}

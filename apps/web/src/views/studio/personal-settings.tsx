import { useEffect, useState } from "react";
import { toast } from "@/components/glaze/ui/toast";
import { z } from "zod";
import SyncSettings from "@/components/sync/SyncSettings";
import ScreenTimeSettings from "@/components/learning/ScreenTimeSettings";
import SettingsSection from "@/components/layout/SettingsSection";
import PageFrame from "@/components/layout/PageFrame";
import AppearanceSettings from "@/components/settings/AppearanceSettings";
import { Alert, AlertDescription } from "@/components/glaze/ui/alert";
import {
    AttachmentDrop,
    AttachmentDropTrigger,
} from "@/components/glaze/ui/attachment";
import { Button } from "@/components/glaze/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/glaze/ui/collapsible";
import { CopyButton } from "@/components/glaze/ui/copy-button";
import { Download } from "@/components/glaze/icon";
import { Icon } from "@/components/glaze/icon";
import { Field, FieldDescription, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/glaze/ui/select";
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

const MODEL_ITEMS = FREE_GEMINI_MODELS.map((value) => ({
    value,
    label: value,
}));

export default function PersonalSettingsPage() {
    const [key, setKey] = useState("");
    const [model, setModel] = useState<string>(
        DEFAULT_CONFIG.modelByProvider.gemini,
    );
    const [connections, setConnections] = useState<
        ScoutAgentConnection[] | null
    >(null);
    const [error, setError] = useState<string | null>(null);
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
        <PageFrame title="Settings" width="reading">
            <AppearanceSettings />
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
                    className="grid gap-4"
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
                    <Field>
                        <FieldLabel>Gemini API key</FieldLabel>
                        <Input
                            mode="password"
                            value={key}
                            onChange={(event) => setKey(event.target.value)}
                            placeholder="Leave blank to keep your saved key"
                            autoComplete="off"
                        />
                        <FieldDescription>
                            Saved in this browser only. Keys are excluded from
                            cloud sync and backups.
                        </FieldDescription>
                    </Field>
                    <Field>
                        <FieldLabel>Model</FieldLabel>
                        <Select
                            items={MODEL_ITEMS}
                            value={model}
                            onValueChange={(value) => {
                                if (typeof value === "string") setModel(value);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Pick a model" />
                            </SelectTrigger>
                            <SelectContent>
                                {MODEL_ITEMS.map((item) => (
                                    <SelectItem
                                        key={item.value}
                                        value={item.value}
                                    >
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit">Save AI settings</Button>
                        <Button
                            type="button"
                            variant="secondary"
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
                        </Button>
                    </div>
                </form>
            </SettingsSection>
            <SyncSettings />
            <ScreenTimeSettings />
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
                <AttachmentDrop
                    accept=".json,application/json"
                    multiple={false}
                    onFiles={(files) => void restore(files[0])}
                >
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={exportData}>
                            <Icon icon={Download} size={14} />
                            Export backup
                        </Button>
                        <AttachmentDropTrigger variant="secondary">
                            Restore backup
                        </AttachmentDropTrigger>
                    </div>
                </AttachmentDrop>
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
                <div>
                    <Button
                        variant="secondary"
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
                    </Button>
                </div>
                {connections?.map((connection) => (
                    <Collapsible key={connection.id}>
                        <CollapsibleTrigger>
                            {connection.label}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <p className="type-body-sm text-text-2">
                                {connection.note}
                            </p>
                            <pre className="code-surface mt-3 overflow-x-auto rounded-panel p-3 type-code-block">
                                {connection.snippet}
                            </pre>
                            <CopyButton
                                className="mt-3"
                                value={connection.snippet}
                                label="Copy snippet"
                                showLabel
                            />
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </SettingsSection>
            {error && (
                <Alert status="fail">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </PageFrame>
    );
}

import { fetchPrivateApi } from "@/lib/private-api-fetch";
import { Suspense, type ReactNode, useEffect, useState, useTransition } from "react";
import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useSearchParams } from "@/lib/router-nav";
import {
    ArrowUpRight,
    Check,
    Copy,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    HardDrive,
    Info,
    KeyRound,
    Loader2,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { applyAccentTheme, applyVisualDensity } from "@/lib/accent-theme";
import { AI_PROVIDER_OPTIONS, getAiProviderLabel, PROVIDER_KEY_LABELS, PROVIDER_KEY_PLACEHOLDERS, PROVIDER_MODEL_PRESETS } from "@/lib/ai-config";
import { getEffectivePlanId, getPlanName } from "@/lib/billing";
import {
    clearUserConfig,
    DEFAULT_CONFIG,
    getActiveApiKey,
    getActiveModel,
    getUserConfig,
    saveUserConfig,
    type UserConfig,
} from "@/lib/userConfig";
import { getRoadmapsBackupJson, getStorage, getStorageStatus } from "@/lib/storage";
import { scoutApi } from "@/lib/scout/api-client";
import type { ScoutAgentConnection, ScoutAgentStatus } from "@/lib/scout/types";
import type { CreditStatus, CreditTransaction, PrivacySettings, StorageStatus } from "@/types";

const ACCENT_COLORS = ["#4CB3F0", "#3FC07A", "#E5A93B", "#F07B4C", "#E5566F", "#C6F24E", "#E6E6E6"];

type Category = "general" | "billing" | "privacy" | "ai" | "agents";
type ToastState = { tone: "success" | "neutral" | "error"; message: string } | null;

function formatDate(value: string | null | undefined) {
    if (!value) return null;
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(new Date(value));
}

function formatRelativeDate(value: string | null | undefined) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(date);
}

function downloadJsonFile(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function getPlanBadgeClasses(planId: string) {
    if (planId === "agency") return "bg-accent-soft text-accent";
    if (planId === "pro") return "bg-accent-soft text-accent";
    return "border-border bg-surface text-text-muted";
}

function getStatusBadgeClasses(status: string | null | undefined) {
    if (status === "active" || status === "trialing") {
        return "bg-accent-soft text-accent";
    }
    if (status === "past_due") {
        return "bg-warning-soft text-warning";
    }
    if (status === "canceled") {
        return "bg-danger-soft text-danger";
    }
    return "border-border bg-surface text-text-muted";
}

function getTransactionLabel(kind: CreditTransaction["kind"]) {
    if (kind === "workspace_generation") return "Workspace generation";
    if (kind === "module_regeneration") return "Module regeneration";
    if (kind === "quiz") return "Quiz generation";
    if (kind === "export_pdf") return "PDF export";
    if (kind === "review") return "90-day review";
    return "Credit adjustment";
}

function Toast({ toast, onClose }: { toast: NonNullable<ToastState>; onClose: () => void }) {
    const toneClass =
        toast.tone === "success"
            ? "bg-success-soft text-success"
            : toast.tone === "error"
                ? "bg-danger-soft text-danger"
                : "border-border bg-surface text-text";

    return (
        <div className={`fixed right-4 top-20 z-[80] max-w-md rounded-2xl border px-4 py-3 text-sm shadow-2xl ${toneClass}`}>
            <div className="flex items-start gap-3">
                <div className="mt-0.5">
                    {toast.tone === "success" ? <Check size={16} /> : <Info size={16} />}
                </div>
                <p className="flex-1 leading-6">{toast.message}</p>
                <button type="button" onClick={onClose} className="text-text-muted transition-colors hover:text-text">
                    x
                </button>
            </div>
        </div>
    );
}

function SectionCard({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="settings-section">
            <div>
                <h2 className="text-2xl font-semibold text-text">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-text-muted">{description}</p>
            </div>
            <Separator />
            <div className="space-y-6">{children}</div>
        </section>
    );
}

function SettingRow({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <div className="settings-field">
            <div>
                <h3 className="text-sm font-semibold text-text">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">{children}</div>
        </div>
    );
}

function Toggle({
    checked,
    disabled,
    onChange,
}: {
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="studio-page" />}>
            <SettingsContent />
        </Suspense>
    );
}

function SettingsContent() {
    const navigate = useNavigate();
    const searchParams = useSearchParams();
    const [config, setConfig] = useState<UserConfig>(DEFAULT_CONFIG);
    const [activeCategory, setActiveCategory] = useState<Category>("general");
    const [storageStatus, setStorageStatus] = useState<StorageStatus>({
        mode: "local-only",
        cloudAvailable: false,
        email: null,
    });
    const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
    const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showKey, setShowKey] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [testingKey, setTestingKey] = useState(false);
    const [testMessage, setTestMessage] = useState<string | null>(null);
    const [testTone, setTestTone] = useState<"success" | "error" | "neutral">("neutral");
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState<ToastState>(null);
    const [agents, setAgents] = useState<ScoutAgentStatus[]>([]);
    const [agentConnections, setAgentConnections] = useState<ScoutAgentConnection[]>([]);
    const [agentsLoading, setAgentsLoading] = useState(false);
    const [agentsError, setAgentsError] = useState<string | null>(null);

    useEffect(() => {
        setConfig(getUserConfig());
    }, []);

    useEffect(() => {
        applyAccentTheme(config.accentColor);
    }, [config.accentColor]);

    useEffect(() => {
        applyVisualDensity(config.visualDensity);
    }, [config.visualDensity]);

    useEffect(() => {
        const tab = searchParams.get("tab");

        if (tab === "billing" || tab === "privacy" || tab === "ai" || tab === "agents") {
            setActiveCategory(tab);
        } else if (tab === "account" || tab === "appearance" || tab === "general") {
            setActiveCategory("general");
        }
    }, [searchParams]);

    // Agent detection spawns short `--version` probes, so it only runs when the
    // learner opens this tab.
    useEffect(() => {
        if (activeCategory !== "agents") return;

        let active = true;
        setAgentsLoading(true);
        setAgentsError(null);

        void (async () => {
            try {
                const result = await scoutApi.getAgents();
                if (!active) return;
                setAgents(result.agents);
                setAgentConnections(result.connections);
            } catch (error) {
                if (active) {
                    setAgentsError(error instanceof Error && error.message ? error.message : "Could not check agents.");
                }
            } finally {
                if (active) setAgentsLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [activeCategory]);

    useEffect(() => {
        let active = true;

        const loadSettings = async () => {
            setLoading(true);

            const nextStorageStatus = await getStorageStatus();
            if (!active) return;

            setStorageStatus(nextStorageStatus);

            try {
                const creditsRes = await fetchPrivateApi("/api/credits/status");
                if (!active) return;

                if (creditsRes.ok) {
                    const creditsJson = (await creditsRes.json()) as {
                        success: boolean;
                        status?: CreditStatus;
                        transactions?: CreditTransaction[];
                    };
                    setCreditStatus(creditsJson.status ?? null);
                    setTransactions(creditsJson.transactions ?? []);
                }
            } catch (error) {
                console.error("Settings load error:", error);
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadSettings();

        return () => {
            active = false;
        };
    }, []);

    const effectivePlanId = getEffectivePlanId(null);

    function switchCategory(next: Category) {
        setActiveCategory(next);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", next);
        navigate({
            to: "/settings",
            search: Object.fromEntries(params),
            replace: true,
        });
    }

    async function refreshRemoteSettings() {
        try {
            const creditsRes = await fetchPrivateApi("/api/credits/status");

            if (creditsRes.ok) {
                const creditsJson = (await creditsRes.json()) as {
                    success: boolean;
                    status?: CreditStatus;
                    transactions?: CreditTransaction[];
                };
                setCreditStatus(creditsJson.status ?? null);
                setTransactions(creditsJson.transactions ?? []);
            }
        } catch (error) {
            console.error("Refresh settings error:", error);
        }
    }

    function handleSaveConfig() {
        saveUserConfig(config);
        setSavingConfig(true);
        setToast({ tone: "success", message: "Studio preferences saved locally in this browser." });
        window.setTimeout(() => setSavingConfig(false), 800);
    }

    function handleResetConfig() {
        setConfig(DEFAULT_CONFIG);
        clearUserConfig();
        setToast({ tone: "neutral", message: "Local studio preferences were reset to defaults." });
    }

    async function handleTestApiKey() {
        const activeApiKey = getActiveApiKey(config);
        if (!activeApiKey) {
            setTestTone("error");
            setTestMessage(`Add a ${PROVIDER_KEY_LABELS[config.provider]} before testing the connection.`);
            return;
        }

        setTestingKey(true);
        setTestMessage(null);

        try {
            const res = await fetchPrivateApi("/api/parse-roadmap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: "connection-test",
                    testOnly: true,
                    userApiKey: activeApiKey,
                    userModel: getActiveModel(config),
                    userProvider: config.provider,
                }),
            });

            const payload = (await res.json()) as { success?: boolean; error?: string };
            if (payload.error === "invalid_key" || !res.ok) {
                setTestTone("error");
                setTestMessage(`The ${getAiProviderLabel(config.provider)} key could not be verified. Check the key and billing status, then try again.`);
                return;
            }

            setTestTone("success");
            setTestMessage(`${getAiProviderLabel(config.provider)} connection confirmed. BYOK requests will use this provider and skip shared studio credits.`);
        } catch (error) {
            console.error("API key test error:", error);
            setTestTone("error");
            setTestMessage("Connection test failed. Check your network and try again.");
        } finally {
            setTestingKey(false);
        }
    }

    async function handleExportData() {
        setExporting(true);

        try {
            downloadJsonFile(`zns-studio-local-export-${new Date().toISOString().slice(0, 10)}.json`, {
                exportedAt: new Date().toISOString(),
                storageMode: storageStatus.mode,
                config,
                workspaceState: JSON.parse(getRoadmapsBackupJson()),
            });
            setToast({ tone: "success", message: "Local browser export downloaded." });
        } catch (error) {
            console.error("Export error:", error);
            setToast({ tone: "error", message: "Export failed. Please try again." });
        } finally {
            setExporting(false);
        }
    }

    async function handleDeleteEverything() {
        setDeleting(true);

        try {
            getStorage().clearRoadmaps();
            clearUserConfig();
            setConfig(DEFAULT_CONFIG);
            setCreditStatus(null);
            setTransactions([]);
            setToast({ tone: "success", message: "Local browser data was cleared from this device." });
            window.setTimeout(() => window.location.reload(), 350);
        } catch (error) {
            console.error("Delete error:", error);
            setToast({ tone: "error", message: "Delete failed. Please try again." });
        } finally {
            setDeleting(false);
        }
    }

    async function handleCopy(value: string, label: string) {
        try {
            await navigator.clipboard.writeText(value);
            setToast({ tone: "success", message: `${label} copied.` });
        } catch {
            setToast({ tone: "error", message: "Copy failed. Select the text instead." });
        }
    }

    const categoryButtons = [
        {
            id: "general" as const,
            label: "General",
            description: "Storage mode, plan status, and local studio preferences.",
        },
        {
            id: "ai" as const,
            label: "AI / API Key",
            description: "Choose shared studio AI or your own provider key.",
        },
        {
            id: "agents" as const,
            label: "Agents",
            description: "Connect opencode, Codex or Claude, and give them Scout's library tools.",
        },
        {
            id: "privacy" as const,
            label: "Privacy",
            description: "Export local data, review data handling, and delete all data.",
        },
        {
            id: "billing" as const,
            label: "Billing",
            description: "Plan, monthly credit allowance, and recent credit activity.",
        },
    ];

    const activeCategoryMeta = categoryButtons.find((item) => item.id === activeCategory) ?? categoryButtons[0];
    const storageModeLabel = "Local-only";

    return (
        <div className="studio-page">
            {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

            <header className="app-header-block">
                <h1>Settings</h1>
                <p className="max-w-2xl text-sm text-text-muted">{activeCategoryMeta.description}</p>
            </header>

            <div className="settings-shell lg:grid-cols-[180px_minmax(0,1fr)]">
                <nav className="settings-nav lg:sticky lg:top-6">
                    {categoryButtons.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => switchCategory(item.id)}
                            className="settings-nav-link text-left"
                            data-active={activeCategory === item.id}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="settings-content">
                    {activeCategory === "general" && (
                        <SectionCard
                            title="General"
                            description="Manage storage, plan, and browser-scoped studio preferences."
                        >
                            <div className="settings-field">
                                <div className="flex flex-wrap items-center gap-3">
                                    <HardDrive size={18} className="text-text-muted" />
                                    <div>
                                        <h3 className="text-sm font-semibold text-text">Local-only storage</h3>
                                        <p className="mt-1 text-sm leading-6 text-text-muted">
                                            All roadmaps and studio preferences are saved in this browser and never leave your device. Your work stays private and works offline.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold   ${getPlanBadgeClasses(effectivePlanId)}`}>
                                        {getPlanName(effectivePlanId)} plan
                                    </span>
                                </div>
                            </div>

                            <SettingRow
                                title="Storage mode"
                                description="Roadmaps are stored locally in this browser only. No account or sync is required."
                            >
                                <span className="text-sm font-medium text-text">{storageModeLabel}</span>
                            </SettingRow>

                            <div className="settings-field">
                                <div>
                                    <h3 className="text-sm font-semibold text-text">Accent color</h3>
                                    <p className="mt-1 text-sm leading-6 text-text-muted">
                                        Choose the highlight color used across this browser session.
                                    </p>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    {ACCENT_COLORS.map((color) => {
                                        const active = config.accentColor === color;
                                        return (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setConfig((current) => ({ ...current, accentColor: color }))}
                                                className={`h-12 w-12 rounded-full border transition-transform  ${active ? "border-text-primary " : "border-border"
                                                    }`}
                                                style={{ backgroundColor: color }}
                                                aria-label={`Use accent color ${color}`}
                                            />
                                        );
                                    })}
                                </div>
                            </div>

                            <SettingRow
                                title="Show progress notices"
                                description="Keep lightweight completion hints and nudges visible in the local studio interface."
                            >
                                <Toggle
                                    checked={config.showProgressNotice}
                                    onChange={(next) => setConfig((current) => ({ ...current, showProgressNotice: next }))}
                                />
                            </SettingRow>

                            <SettingRow
                                title="Measurement style"
                                description="Choose how progress is displayed across modules and the analytics page."
                            >
                                <div className="flex gap-2 flex-wrap">
                                    {(["tasks", "time", "both"] as const).map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setConfig((c) => ({ ...c, measurementStyle: opt }))}
                                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all capitalize ${
                                                config.measurementStyle === opt
                                                    ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-text"
                                                    : "border-border text-text-muted hover:border-text-soft hover:text-text"
                                            }`}
                                        >
                                            {opt === "tasks" ? "Tasks completed" : opt === "time" ? "Time spent" : "Both"}
                                        </button>
                                    ))}
                                </div>
                            </SettingRow>

                            <SettingRow
                                title="Visual density"
                                description="Compact mode reduces spacing in lists and cards to show more content at once."
                            >
                                <div className="flex gap-2 flex-wrap">
                                    {(["default", "compact"] as const).map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setConfig((c) => ({ ...c, visualDensity: opt }))}
                                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all capitalize ${
                                                config.visualDensity === opt
                                                    ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-text"
                                                    : "border-border text-text-muted hover:border-text-soft hover:text-text"
                                            }`}
                                        >
                                            {opt === "default" ? "Default" : "Compact"}
                                        </button>
                                    ))}
                                </div>
                            </SettingRow>

                            <div className="settings-action-row">
                                <div className="mr-auto">
                                    <Button type="button" variant="secondary" onClick={handleResetConfig}>
                                        Reset local preferences
                                    </Button>
                                </div>
                                <Button type="button" onClick={handleSaveConfig}>
                                    {savingConfig ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    Save changes
                                </Button>
                            </div>
                        </SectionCard>
                    )}

                    {activeCategory === "billing" && (
                        <SectionCard
                            title="Billing"
                            description="Review plan status, current allowance, and recent credit activity."
                        >
                            <div className="settings-field">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold   ${getPlanBadgeClasses(effectivePlanId)}`}>
                                        {getPlanName(effectivePlanId)}
                                    </span>
                                </div>
                                <p className="mt-4 text-sm leading-7 text-text-muted">
                                    You are on the free studio tier: up to 3 workspaces and 10 shared AI generations per month. Bring your own provider key (BYOK) to skip credit deductions entirely.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <Link to="/pricing" className="button-primary">
                                        View pricing
                                        <ArrowUpRight size={14} />
                                    </Link>
                                    <Link to="/pricing" className="button-secondary">
                                        Compare plans
                                        <ExternalLink size={14} />
                                    </Link>
                                </div>
                            </div>

                            <div className="settings-field">
                                <h3 className="text-sm font-semibold text-text">Monthly credits</h3>
                                <p className="mt-1 text-sm leading-6 text-text-muted">
                                    {creditStatus
                                        ? `${creditStatus.remaining} remaining. ${creditStatus.used} used out of ${creditStatus.allowance}. Resets ${formatDate(creditStatus.resetDate)}.`
                                        : "Loading current credit allowance."}
                                </p>
                                {creditStatus && (
                                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-border/70">
                                        <div
                                            className="h-full rounded-full bg-accent"
                                            style={{ width: `${Math.max(8, Math.min(100, (creditStatus.used / Math.max(creditStatus.allowance, 1)) * 100))}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="settings-field">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-text">Recent transactions</h3>
                                        <p className="mt-1 text-sm leading-6 text-text-muted">Latest credit activity for this device.</p>
                                    </div>
                                    <button type="button" onClick={() => void refreshRemoteSettings()} className="button-secondary">
                                        Refresh
                                    </button>
                                </div>

                                <div className="mt-4 space-y-3">
                                    {transactions.length > 0 ? (
                                        transactions.map((transaction) => (
                                            <div key={transaction.id} className="rounded-[18px] border border-border bg-surface px-4 py-4">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-text">{getTransactionLabel(transaction.kind)}</p>
                                                        <p className="mt-1 text-xs text-text-muted">{formatRelativeDate(transaction.createdAt)}</p>
                                                    </div>
                                                    <div className="text-left sm:text-right">
                                                        <p className="text-sm font-semibold text-text">{transaction.amount} credits</p>
                                                        {transaction.metadata?.roadmapTitle && (
                                                            <p className="mt-1 text-sm text-text-muted">{transaction.metadata.roadmapTitle}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-[18px] border border-dashed border-border px-4 py-6 text-sm leading-7 text-text-muted">
                                            No credit transactions yet. Generated work, quizzes, and reviews will appear here.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    {activeCategory === "privacy" && (
                        <SectionCard
                            title="Privacy"
                            description="Export local data and manage destructive actions."
                        >
                            <SettingRow
                                title="Export your data"
                                description="Download the roadmaps and local studio preferences stored in this browser."
                            >
                                <button
                                    type="button"
                                    onClick={() => void handleExportData()}
                                    disabled={exporting}
                                    className="button-secondary disabled:opacity-60"
                                >
                                    {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    Download export
                                </button>
                            </SettingRow>

                            <div className="settings-field">
                                <div>
                                    <h3 className="text-sm font-semibold text-danger">Danger zone</h3>
                                    <p className="mt-1 text-sm leading-6 text-text-muted">
                                        This clears all roadmaps, credit history, and studio preferences from this browser only. Other devices and browsers are not affected.
                                    </p>
                                </div>

                                <div className="mt-6">
                                    <Button
                                        type="button"
                                        onClick={() => void handleDeleteEverything()}
                                        disabled={deleting}
                                        variant="destructive"
                                    >
                                        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                        Delete all data
                                    </Button>
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    {activeCategory === "ai" && (
                        <SectionCard
                            title="AI / API Key"
                            description="Gemini is the default provider. Add your own key to skip studio credits, or switch to any other supported provider."
                        >
                            <SettingRow
                                title="Use your own provider key"
                                description="When enabled, requests use the selected provider and skip studio credit deductions. Add your Gemini API key below to get started."
                            >
                                <Toggle
                                    checked={config.useCustomKey}
                                    onChange={(next) => setConfig((current) => ({ ...current, useCustomKey: next }))}
                                />
                            </SettingRow>

                            <div className="settings-field">
                                <div>
                                    <h3 className="text-sm font-semibold text-text">Provider</h3>
                                    <p className="mt-1 text-sm leading-6 text-text-muted">
                                        Pick the provider and model used when BYOK is enabled.
                                    </p>
                                </div>
                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                            {AI_PROVIDER_OPTIONS.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() =>
                                                        setConfig((current) => ({
                                                            ...current,
                                                            provider: option.value,
                                                        }))
                                                    }
                                                    className={`rounded-[18px] border px-4 py-3 text-left transition-colors ${
                                                        config.provider === option.value
                                                            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                                                            : "border-border bg-surface hover:border-border-strong"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-text">
                                                        <span>{option.label}</span>
                                                        {option.value === "gemini" ? (
                                                            <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                                                                Default
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-1 text-sm leading-6 text-text-muted">{option.description}</div>
                                                </button>
                                            ))}
                                </div>
                            </div>

                            <div className="settings-field">
                                <label className="text-sm font-semibold text-text" htmlFor="provider-model">
                                    Model
                                </label>
                                <p className="mt-1 text-sm leading-6 text-text-muted">
                                    Choose a preset or enter a model id manually.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {PROVIDER_MODEL_PRESETS[config.provider].map((model) => (
                                        <Button
                                            key={model}
                                            type="button"
                                            variant={getActiveModel(config) === model ? "default" : "outline"}
                                            size="sm"
                                            onClick={() =>
                                                setConfig((current) => ({
                                                    ...current,
                                                    modelByProvider: {
                                                        ...current.modelByProvider,
                                                        [current.provider]: model,
                                                    },
                                                }))
                                            }
                                        >
                                            {model}
                                        </Button>
                                    ))}
                                </div>
                                <Input
                                    id="provider-model"
                                    value={getActiveModel(config)}
                                    onChange={(event) =>
                                        setConfig((current) => ({
                                            ...current,
                                            modelByProvider: {
                                                ...current.modelByProvider,
                                                [current.provider]: event.target.value,
                                            },
                                        }))
                                    }
                                    placeholder="Enter a model id"
                                    className="mt-3"
                                />
                            </div>

                            <div className="settings-field">
                                <label className="text-sm font-semibold text-text" htmlFor="provider-api-key">
                                    {PROVIDER_KEY_LABELS[config.provider]}
                                </label>
                                <p className="mt-1 text-sm leading-6 text-text-muted">
                                    Provider keys stay in this browser and are never written to Supabase.
                                </p>
                                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                    <div className="relative flex-1">
                                        <Input
                                            id="provider-api-key"
                                            type={showKey ? "text" : "password"}
                                            value={config.apiKeys[config.provider]}
                                            onChange={(event) =>
                                                setConfig((current) => ({
                                                    ...current,
                                                    apiKeys: {
                                                        ...current.apiKeys,
                                                        [current.provider]: event.target.value,
                                                    },
                                                }))
                                            }
                                            placeholder={PROVIDER_KEY_PLACEHOLDERS[config.provider]}
                                            className="pr-12"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey((current) => !current)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2"
                                        >
                                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={() => void handleTestApiKey()}
                                        disabled={testingKey}
                                        variant="secondary"
                                        className="justify-center"
                                    >
                                        {testingKey ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                                        Test connection
                                    </Button>
                                </div>

                                {testMessage && (
                                    <div
                                        className={`mt-4 rounded-[18px] border px-4 py-3 text-sm leading-7 ${testTone === "success"
                                                ? "bg-accent-soft text-accent"
                                                : testTone === "error"
                                                    ? "bg-danger-soft text-danger"
                                                    : "border-border bg-surface text-text"
                                            }`}
                                    >
                                        {testMessage}
                                    </div>
                                )}
                            </div>

                            <div className="settings-action-row">
                                <Button type="button" onClick={handleSaveConfig}>
                                    {savingConfig ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    Save changes
                                </Button>
                            </div>
                        </SectionCard>
                    )}

                    {activeCategory === "agents" && (
                        <SectionCard
                            title="Agents"
                            description="Scout can ask a coding agent you already use to research resources. Your agent can also add and search Scout's library over MCP. No keys move between them."
                        >
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-semibold text-text">Installed agents</h3>
                                    {agentsLoading ? <Loader2 size={14} className="animate-spin text-text-muted" /> : null}
                                </div>

                                {agentsError ? (
                                    <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                                        {agentsError}
                                    </p>
                                ) : agents.length === 0 && !agentsLoading ? (
                                    <p className="text-sm leading-7 text-text-muted">
                                        No agents detected yet. Install opencode, Codex or Claude Code and reopen this tab.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {agents.map((agent) => (
                                            <li
                                                key={agent.id}
                                                className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border bg-surface px-4 py-3"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        aria-hidden="true"
                                                        className={`h-2 w-2 rounded-full ${agent.available ? "bg-accent" : "bg-text"}`}
                                                    />
                                                    <div>
                                                        <p className="text-sm font-semibold text-text">{agent.label}</p>
                                                        <p className="mt-0.5 font-mono text-xs text-text-muted">
                                                            {agent.available
                                                                ? agent.version ?? "Installed"
                                                                : `${agent.command ?? agent.id} not found on PATH`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span
                                                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold   ${
                                                        agent.available
                                                            ? "bg-accent-soft text-accent"
                                                            : "border-border bg-surface text-text-muted"
                                                    }`}
                                                >
                                                    {agent.available ? "Ready" : "Not installed"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <p className="text-xs leading-5 text-text-muted">
                                    Scout runs agents with an explicit folder, a timeout, and no auto-approve flags. The goal is the
                                    only thing sent to the agent.
                                </p>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-text">Give your agent Scout&apos;s tools</h3>
                                    <p className="mt-1 text-sm leading-6 text-text-muted">
                                        Add this MCP server to your agent, then ask it to save links or search what you already have.
                                        The server reads the same local database as Scout.
                                    </p>
                                </div>

                                {agentConnections.map((connection) => (
                                    <div key={connection.id} className="rounded-[18px] border border-border bg-surface">
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                                            <div>
                                                <p className="text-sm font-semibold text-text">{connection.label}</p>
                                                <p className="mt-0.5 font-mono text-xs text-text-muted">{connection.file}</p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void handleCopy(connection.snippet, `${connection.label} config`)}
                                            >
                                                <Copy size={14} /> Copy
                                            </Button>
                                        </div>
                                        <pre className="overflow-x-auto px-4 py-3 text-xs leading-5 text-text-muted">
                                            <code>{connection.snippet}</code>
                                        </pre>
                                        <p className="border-t border-border px-4 py-2 text-xs leading-5 text-text-muted">
                                            {connection.note}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}
                </div>
            </div>
        </div>
    );
}

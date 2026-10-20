import { Suspense, type ReactNode, useEffect, useState, useTransition } from "react";
import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useSearchParams } from "@/lib/router-nav";
import {
    ArrowUpRight,
    Check,
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
import type { CreditStatus, CreditTransaction, PrivacySettings, StorageStatus } from "@/types";

const ACCENT_COLORS = ["#4F7CFF", "#C69B5A", "#2FA67D", "#D96868", "#7C67FF", "#D9A441", "#0EA5E9", "#EC4899"];

type Category = "general" | "billing" | "privacy" | "ai";
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
    if (planId === "agency") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (planId === "pro") return "border-blue-200 bg-blue-50 text-blue-700";
    return "border-border bg-surface text-text-secondary";
}

function getStatusBadgeClasses(status: string | null | undefined) {
    if (status === "active" || status === "trialing") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (status === "past_due") {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }
    if (status === "canceled") {
        return "border-red-200 bg-red-50 text-red-700";
    }
    return "border-border bg-surface text-text-secondary";
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
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : toast.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-border bg-surface text-text-primary";

    return (
        <div className={`fixed right-4 top-20 z-[80] max-w-md rounded-2xl border px-4 py-3 text-sm shadow-2xl ${toneClass}`}>
            <div className="flex items-start gap-3">
                <div className="mt-0.5">
                    {toast.tone === "success" ? <Check size={16} /> : <Info size={16} />}
                </div>
                <p className="flex-1 leading-6">{toast.message}</p>
                <button type="button" onClick={onClose} className="text-text-secondary transition-colors hover:text-text-primary">
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
                <h2 className="text-2xl font-semibold text-text-primary">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-text-secondary">{description}</p>
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
                <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
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

        if (tab === "billing" || tab === "privacy" || tab === "ai") {
            setActiveCategory(tab);
        } else if (tab === "account" || tab === "appearance" || tab === "general") {
            setActiveCategory("general");
        }
    }, [searchParams]);

    useEffect(() => {
        let active = true;

        const loadSettings = async () => {
            setLoading(true);

            const nextStorageStatus = await getStorageStatus();
            if (!active) return;

            setStorageStatus(nextStorageStatus);

            try {
                const creditsRes = await fetch("/api/credits/status");
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
            const creditsRes = await fetch("/api/credits/status");

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
            const res = await fetch("/api/parse-roadmap", {
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
                <div>
                    <p className="eyebrow">Settings</p>
                    <h1 className="mt-3 text-4xl font-display leading-none text-text-primary md:text-5xl">Studio settings</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">{activeCategoryMeta.description}</p>
                </div>
            </header>

            <div className="settings-shell lg:grid-cols-[180px_minmax(0,1fr)]">
                <nav className="settings-nav lg:sticky lg:top-24">
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
                                    <HardDrive size={18} className="text-text-secondary" />
                                    <div>
                                        <h3 className="text-sm font-semibold text-text-primary">Local-only storage</h3>
                                        <p className="mt-1 text-sm leading-6 text-text-secondary">
                                            All roadmaps and studio preferences are saved in this browser and never leave your device. Your work stays private and works offline.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getPlanBadgeClasses(effectivePlanId)}`}>
                                        {getPlanName(effectivePlanId)} plan
                                    </span>
                                </div>
                            </div>

                            <SettingRow
                                title="Storage mode"
                                description="Roadmaps are stored locally in this browser only. No account or sync is required."
                            >
                                <span className="text-sm font-medium text-text-primary">{storageModeLabel}</span>
                            </SettingRow>

                            <div className="settings-field">
                                <div>
                                    <h3 className="text-sm font-semibold text-text-primary">Accent color</h3>
                                    <p className="mt-1 text-sm leading-6 text-text-secondary">
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
                                                className={`h-12 w-12 rounded-full border transition-transform hover:scale-105 ${active ? "border-text-primary shadow-[0_0_0_4px_rgba(79,124,255,0.12)]" : "border-border"
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
                                                    ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                                                    : "border-border text-text-secondary hover:border-text-soft hover:text-text-primary"
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
                                                    ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                                                    : "border-border text-text-secondary hover:border-text-soft hover:text-text-primary"
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
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getPlanBadgeClasses(effectivePlanId)}`}>
                                        {getPlanName(effectivePlanId)}
                                    </span>
                                </div>
                                <p className="mt-4 text-sm leading-7 text-text-secondary">
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
                                <h3 className="text-sm font-semibold text-text-primary">Monthly credits</h3>
                                <p className="mt-1 text-sm leading-6 text-text-secondary">
                                    {creditStatus
                                        ? `${creditStatus.remaining} remaining. ${creditStatus.used} used out of ${creditStatus.allowance}. Resets ${formatDate(creditStatus.resetDate)}.`
                                        : "Loading current credit allowance."}
                                </p>
                                {creditStatus && (
                                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-border/70">
                                        <div
                                            className="h-full rounded-full bg-[linear-gradient(90deg,#4F7CFF,#C69B5A)]"
                                            style={{ width: `${Math.max(8, Math.min(100, (creditStatus.used / Math.max(creditStatus.allowance, 1)) * 100))}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="settings-field">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-text-primary">Recent transactions</h3>
                                        <p className="mt-1 text-sm leading-6 text-text-secondary">Latest credit activity for this device.</p>
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
                                                        <p className="text-sm font-semibold text-text-primary">{getTransactionLabel(transaction.kind)}</p>
                                                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-secondary">{formatRelativeDate(transaction.createdAt)}</p>
                                                    </div>
                                                    <div className="text-left sm:text-right">
                                                        <p className="text-sm font-semibold text-text-primary">{transaction.amount} credits</p>
                                                        {transaction.metadata?.roadmapTitle && (
                                                            <p className="mt-1 text-sm text-text-secondary">{transaction.metadata.roadmapTitle}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-[18px] border border-dashed border-border px-4 py-6 text-sm leading-7 text-text-secondary">
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
                                    <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
                                    <p className="mt-1 text-sm leading-6 text-text-secondary">
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
                                    <h3 className="text-sm font-semibold text-text-primary">Provider</h3>
                                    <p className="mt-1 text-sm leading-6 text-text-secondary">
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
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                                                        <span>{option.label}</span>
                                                        {option.value === "gemini" ? (
                                                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                                                Default
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-1 text-sm leading-6 text-text-secondary">{option.description}</div>
                                                </button>
                                            ))}
                                </div>
                            </div>

                            <div className="settings-field">
                                <label className="text-sm font-semibold text-text-primary" htmlFor="provider-model">
                                    Model
                                </label>
                                <p className="mt-1 text-sm leading-6 text-text-secondary">
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
                                <label className="text-sm font-semibold text-text-primary" htmlFor="provider-api-key">
                                    {PROVIDER_KEY_LABELS[config.provider]}
                                </label>
                                <p className="mt-1 text-sm leading-6 text-text-secondary">
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
                                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
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
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                : testTone === "error"
                                                    ? "border-red-200 bg-red-50 text-red-700"
                                                    : "border-border bg-surface text-text-primary"
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
                </div>
            </div>
        </div>
    );
}

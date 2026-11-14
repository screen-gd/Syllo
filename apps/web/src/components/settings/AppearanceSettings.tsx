import { useEffect, useRef, useState } from "react";
import SettingsSection from "@/components/layout/SettingsSection";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import {
    applyAppearance,
    contrastRatio,
    deleteBackgroundImage,
    getAppearance,
    getBackgroundImage,
    PRESET_THEMES,
    resolveTheme,
    saveAppearance,
    saveBackgroundImage,
    type Appearance,
    type AppearanceTheme,
} from "@/lib/appearance";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const COLOR_FIELDS = [
    { key: "page", label: "Page" },
    { key: "surface", label: "Card" },
    { key: "text", label: "Text" },
    { key: "accent", label: "Accent" },
] as const;

/** Appearance section of Settings: theme picker, custom theme editor, photo. */
export default function AppearanceSettings() {
    const [appearance, setAppearance] = useState<Appearance>(getAppearance);
    const [draft, setDraft] = useState<AppearanceTheme | null>(null);
    const [hasImage, setHasImage] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        void getBackgroundImage()
            .then((blob) => setHasImage(Boolean(blob)))
            .catch(() => setHasImage(false));
    }, []);

    function update(next: Appearance) {
        setAppearance(next);
        saveAppearance(next);
        applyAppearance(next);
    }

    function pickTheme(id: string) {
        setDraft(null);
        update({ ...appearance, activeThemeId: id });
    }

    function startDraft(source?: AppearanceTheme) {
        const base = source ?? resolveTheme(appearance);
        setDraft(
            source
                ? { ...source }
                : { ...base, id: `custom:${Date.now()}`, name: "My theme" },
        );
    }

    function previewDraft(next: AppearanceTheme) {
        setDraft(next);
        applyAppearance({
            ...appearance,
            activeThemeId: next.id,
            customThemes: [
                ...appearance.customThemes.filter((theme) => theme.id !== next.id),
                next,
            ],
        });
    }

    function saveDraft() {
        if (!draft) return;
        const customThemes = [
            ...appearance.customThemes.filter((theme) => theme.id !== draft.id),
            draft,
        ];
        setDraft(null);
        update({ ...appearance, activeThemeId: draft.id, customThemes });
    }

    function cancelDraft() {
        setDraft(null);
        applyAppearance(appearance);
    }

    function deleteTheme(id: string) {
        const customThemes = appearance.customThemes.filter((theme) => theme.id !== id);
        const activeThemeId =
            appearance.activeThemeId === id ? "preset:study-desk" : appearance.activeThemeId;
        if (draft?.id === id) setDraft(null);
        update({ ...appearance, activeThemeId, customThemes });
    }

    async function chooseImage(file: File | undefined) {
        if (!file) return;
        if (!IMAGE_TYPES.has(file.type)) {
            setError("Choose a PNG, JPEG or WebP image.");
            return;
        }
        if (file.size > IMAGE_MAX_BYTES) {
            setError("Choose an image smaller than 8 MB.");
            return;
        }
        try {
            await saveBackgroundImage(file);
            setHasImage(true);
            setError(null);
            update({ ...appearance, background: { ...appearance.background, enabled: true } });
        } catch (err) {
            setError(err instanceof Error ? err.message : "The image could not be saved.");
        }
    }

    async function removeImage() {
        try {
            await deleteBackgroundImage();
        } catch {
            /* The flag still turns off even if the blob lingers. */
        }
        setHasImage(false);
        update({ ...appearance, background: { ...appearance.background, enabled: false } });
    }

    const themeWarning = draft && contrastWarning(draft);
    const background = appearance.background;

    return (
        <SettingsSection
            title="Appearance"
            description="Pick a theme, make your own, or put a photo behind the page."
        >
            <div className="sy-form">
                <div className="sy-theme-grid">
                    {[...PRESET_THEMES, ...appearance.customThemes].map((theme) => {
                        const active = theme.id === appearance.activeThemeId;
                        const custom = theme.id.startsWith("custom:");
                        return (
                            <div key={theme.id} className="sy-theme-item">
                                <button
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => pickTheme(theme.id)}
                                    className="sy-theme-card"
                                    style={{ background: theme.page, color: theme.text }}
                                >
                                    <span
                                        className="sy-theme-chip"
                                        style={{ background: theme.surface }}
                                    >
                                        <span
                                            className="sy-theme-dot"
                                            style={{ background: theme.accent }}
                                        />
                                    </span>
                                    <span
                                        className="sy-theme-name"
                                        style={{
                                            fontFamily:
                                                theme.headingFont === "serif"
                                                    ? "var(--font-display)"
                                                    : "var(--font-sans)",
                                        }}
                                    >
                                        {theme.name}
                                    </span>
                                </button>
                                {custom && (
                                    <span className="sy-theme-tools">
                                        <button
                                            type="button"
                                            className="sy-theme-tool"
                                            onClick={() => startDraft(theme)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="sy-theme-tool"
                                            onClick={() => deleteTheme(theme.id)}
                                        >
                                            Delete
                                        </button>
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    <button
                        type="button"
                        className="sy-theme-card sy-theme-new"
                        onClick={() => startDraft()}
                    >
                        <span className="sy-theme-name">New theme</span>
                    </button>
                </div>

                {draft && (
                    <div className="sy-box sy-theme-editor">
                        <div className="sy-field">
                            <label className="sy-form-hint" htmlFor="theme-name">
                                Name
                            </label>
                            <input
                                id="theme-name"
                                className="sy-input"
                                value={draft.name}
                                maxLength={40}
                                onChange={(event) =>
                                    previewDraft({ ...draft, name: event.target.value })
                                }
                            />
                        </div>
                        <div className="sy-color-row">
                            {COLOR_FIELDS.map((field) => (
                                <div key={field.key} className="sy-field sy-color-field">
                                    <label
                                        className="sy-form-hint"
                                        htmlFor={`theme-${field.key}`}
                                    >
                                        {field.label}
                                    </label>
                                    <span className="sy-color-input">
                                        <input
                                            type="color"
                                            id={`theme-${field.key}`}
                                            value={draft[field.key]}
                                            onChange={(event) =>
                                                previewDraft({
                                                    ...draft,
                                                    [field.key]: event.target.value,
                                                })
                                            }
                                        />
                                        <input
                                            className="sy-input"
                                            value={draft[field.key]}
                                            aria-label={`${field.label} hex`}
                                            onChange={(event) =>
                                                /^#[0-9a-f]{6}$/i.test(event.target.value) &&
                                                previewDraft({
                                                    ...draft,
                                                    [field.key]: event.target.value,
                                                })
                                            }
                                        />
                                    </span>
                                </div>
                            ))}
                        </div>
                        <Segmented
                            label="Heading font"
                            value={draft.headingFont}
                            options={[
                                { key: "serif", label: "Serif" },
                                { key: "sans", label: "Sans" },
                            ]}
                            onChange={(headingFont) => previewDraft({ ...draft, headingFont })}
                        />
                        {themeWarning && (
                            <p className="sy-form-hint" role="status">
                                {themeWarning}
                            </p>
                        )}
                        <div className="sy-card-actions">
                            <button
                                type="button"
                                className="sy-button primary"
                                disabled={!draft.name.trim()}
                                onClick={saveDraft}
                            >
                                Save theme
                            </button>
                            <button
                                type="button"
                                className="sy-button quiet"
                                onClick={cancelDraft}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="sy-bg-controls">
                    <div className="sy-bg-row">
                        <span className="sy-form-hint">Page photo</span>
                        <span className="sy-bg-actions">
                            <Switch
                                checked={background.enabled && hasImage}
                                disabled={!hasImage}
                                onCheckedChange={(enabled) =>
                                    update({
                                        ...appearance,
                                        background: { ...background, enabled },
                                    })
                                }
                                aria-label="Show page photo"
                            />
                            <button
                                type="button"
                                className="sy-button secondary"
                                onClick={() => fileInput.current?.click()}
                            >
                                Choose image
                            </button>
                            {hasImage && (
                                <button
                                    type="button"
                                    className="sy-button quiet"
                                    onClick={() => void removeImage()}
                                >
                                    Remove image
                                </button>
                            )}
                        </span>
                    </div>
                    <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        onChange={(event) => void chooseImage(event.target.files?.[0])}
                    />
                    {hasImage && (
                        <>
                            <label className="sy-range-row">
                                <span className="sy-form-hint">Page tint</span>
                                <input
                                    type="range"
                                    className="sy-range"
                                    min={40}
                                    max={95}
                                    value={Math.round(background.tint * 100)}
                                    onChange={(event) =>
                                        update({
                                            ...appearance,
                                            background: {
                                                ...background,
                                                tint: Number(event.target.value) / 100,
                                            },
                                        })
                                    }
                                />
                                <span className="sy-range-value">
                                    {Math.round(background.tint * 100)}%
                                </span>
                            </label>
                            <label className="sy-range-row">
                                <span className="sy-form-hint">Blur</span>
                                <input
                                    type="range"
                                    className="sy-range"
                                    min={0}
                                    max={24}
                                    value={background.blur}
                                    onChange={(event) =>
                                        update({
                                            ...appearance,
                                            background: {
                                                ...background,
                                                blur: Number(event.target.value),
                                            },
                                        })
                                    }
                                />
                                <span className="sy-range-value">{background.blur} px</span>
                            </label>
                        </>
                    )}
                    {error && (
                        <p className="sy-error" role="alert">
                            {error}
                        </p>
                    )}
                </div>
            </div>
        </SettingsSection>
    );
}

function contrastWarning(theme: AppearanceTheme): string | null {
    const problems: string[] = [];
    if (contrastRatio(theme.text, theme.page) < 4.5)
        problems.push("text on the page");
    if (contrastRatio(theme.text, theme.surface) < 4.5)
        problems.push("text on cards");
    if (contrastRatio(theme.accent, theme.surface) < 3)
        problems.push("the accent on cards");
    if (problems.length === 0) return null;
    const last = problems.pop();
    const list = problems.length ? `${problems.join(", ")} and ${last}` : last;
    return `Low contrast for ${list}. You can still save, but it may be hard to read.`;
}

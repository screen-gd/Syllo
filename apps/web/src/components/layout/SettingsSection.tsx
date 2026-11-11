import type { ReactNode } from "react";

/**
 * One raised settings panel: the title sits in the header strip, the
 * description beside (or above, on phones) the controls. Used by the
 * Settings page and the cloud sync settings.
 */
export default function SettingsSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="sy-box sy-settings-section">
            <div className="sy-section-head">
                <h2>{title}</h2>
            </div>
            <div className="sy-settings-body">
                {description && (
                    <div className="sy-settings-label">
                        <p className="sy-form-hint">{description}</p>
                    </div>
                )}
                <div className="sy-settings-content">{children}</div>
            </div>
        </section>
    );
}

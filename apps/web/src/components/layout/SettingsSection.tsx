import type { ReactNode } from "react";

/**
 * One settings panel on the page shell: the section title, then the
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
        <section className="shell">
            <div className="panel p-4">
                <h2 className="type-heading-sm">{title}</h2>
                <div className="sy-settings-body">
                    {description && (
                        <div className="sy-settings-label">
                            <p className="type-body-sm text-text-2">{description}</p>
                        </div>
                    )}
                    <div className="sy-settings-content">{children}</div>
                </div>
            </div>
        </section>
    );
}

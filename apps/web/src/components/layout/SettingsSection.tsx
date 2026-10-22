import type { ReactNode } from "react";

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
        <section className="sy-settings-section">
            <div className="sy-settings-label">
                <h2>{title}</h2>
                {description && <p className="sy-form-hint">{description}</p>}
            </div>
            <div className="sy-settings-content">{children}</div>
        </section>
    );
}

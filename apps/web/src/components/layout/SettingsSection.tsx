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
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:gap-6">
                    {description && (
                        <p className="type-body-sm text-text-2 sm:w-56 sm:shrink-0">
                            {description}
                        </p>
                    )}
                    <div className="grid min-w-0 flex-1 gap-4">{children}</div>
                </div>
            </div>
        </section>
    );
}

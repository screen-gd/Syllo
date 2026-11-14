import { z } from "zod";
import SettingsSection from "@/components/layout/SettingsSection";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import {
    SegmentedControl,
    SegmentedControlItem,
} from "@/components/glaze/ui/segmented-control";
import {
    applyTheme,
    saveThemePreference,
    useThemePreference,
} from "@/lib/appearance";

const preferenceSchema = z.enum(["light", "dark", "system"]);

/** Appearance section of Settings: the only choice left is light, dark or system. */
export default function AppearanceSettings() {
    const preference = useThemePreference();

    function choose(value: string | string[]) {
        const parsed = preferenceSchema.safeParse(value);
        if (!parsed.success) return;
        saveThemePreference(parsed.data);
        applyTheme(parsed.data);
    }

    return (
        <SettingsSection
            title="Appearance"
            description="Match the system, or keep the app light or dark."
        >
            <Field>
                <FieldLabel>Theme</FieldLabel>
                <SegmentedControl
                    value={preference}
                    onValueChange={choose}
                    aria-label="Theme"
                >
                    <SegmentedControlItem value="light">Light</SegmentedControlItem>
                    <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
                    <SegmentedControlItem value="system">System</SegmentedControlItem>
                </SegmentedControl>
            </Field>
        </SettingsSection>
    );
}

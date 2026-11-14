import { useCallback, useEffect, useRef, useState } from "react";
import SettingsSection from "@/components/layout/SettingsSection";
import { Button } from "@/components/glaze/ui/button";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
} from "@/components/glaze/ui/field";
import { Switch } from "@/components/glaze/ui/switch";
import { screenTimeApi, useScreenTimeLink } from "@/lib/screen-time/client";
import {
    screenTimeMessage,
    type ScreenTimeStatus,
} from "@/lib/screen-time/contract";

/**
 * The Settings page row that links the Pomodoro timer to the Screen Time app
 * on this computer. Reachability is reported under the toggle whether or not
 * the link is on.
 */
export default function ScreenTimeSettings() {
    const [linked, setLinked] = useScreenTimeLink();
    const [status, setStatus] = useState<ScreenTimeStatus | null>(null);
    const requests = useRef(0);
    const check = useCallback(() => {
        setStatus(null);
        const id = ++requests.current;
        void screenTimeApi.status().then((result) => {
            if (id === requests.current) setStatus(result);
        });
    }, []);
    useEffect(() => {
        check();
        // Bump the counter so a late response cannot land after unmount.
        return () => {
            requests.current += 1;
        };
    }, [check]);
    return (
        <SettingsSection
            title="Screen Time"
            description={
                <>
                    Block distracting apps and sites while a focus period runs.
                    Choose what stays allowed in Screen Time; Syllo and your
                    lesson’s links always stay open. This works only when Syllo
                    runs on the same computer as Screen Time, not from a hosted
                    Syllo.
                </>
            }
        >
            <Field orientation="horizontal">
                <FieldContent>
                    <FieldLabel>
                        Start a Screen Time session with each focus period
                    </FieldLabel>
                    <FieldDescription role="status">
                        {screenTimeMessage(status)}
                    </FieldDescription>
                </FieldContent>
                <Switch
                    aria-label="Link Screen Time to focus periods"
                    checked={linked}
                    onCheckedChange={setLinked}
                />
            </Field>
            <div>
                <Button variant="ghost" onClick={check}>
                    Check again
                </Button>
            </div>
        </SettingsSection>
    );
}

import { useEffect, useRef, useState } from "react";
import { getAppearance, getBackgroundImage } from "@/lib/appearance";

/**
 * The optional photo behind the app. Reads the blob from IndexedDB after
 * first paint, keeps an object URL alive only while the image shows, and
 * reloads whenever applyAppearance announces a settings change.
 */
export default function BackgroundLayer() {
    const [url, setUrl] = useState<string | null>(null);
    const urlRef = useRef<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        const load = () => {
            const enabled = getAppearance().background.enabled;
            void getBackgroundImage()
                .then((blob) => {
                    if (cancelled) return;
                    if (urlRef.current) {
                        URL.revokeObjectURL(urlRef.current);
                        urlRef.current = null;
                    }
                    if (enabled && blob) {
                        urlRef.current = URL.createObjectURL(blob);
                        setUrl(urlRef.current);
                    } else {
                        setUrl(null);
                    }
                })
                .catch(() => {
                    if (!cancelled) setUrl(null);
                });
        };
        load();
        window.addEventListener("syllo:appearance", load);
        return () => {
            cancelled = true;
            window.removeEventListener("syllo:appearance", load);
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        };
    }, []);
    if (!url) return null;
    return <div className="sy-bg" style={{ backgroundImage: `url(${url})` }} aria-hidden />;
}

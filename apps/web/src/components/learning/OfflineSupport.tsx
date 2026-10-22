import { useEffect } from "react";

export default function OfflineSupport() {
    useEffect(() => {
        if (import.meta.env.PROD && "serviceWorker" in navigator) {
            void navigator.serviceWorker.register("/sw.js").catch(() => {
                /* Reading and progress still work without an offline shell. */
            });
        }
    }, []);
    return null;
}

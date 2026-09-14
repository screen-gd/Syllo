import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export const size = {
    width: 1200,
    height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: "100%",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background:
                        "radial-gradient(circle at top left, rgba(99,102,241,0.35), transparent 35%), linear-gradient(180deg, #10131d 0%, #090b12 100%)",
                    color: "#f8fafc",
                    padding: "64px",
                    fontFamily: "sans-serif",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 28, letterSpacing: "0.18em", textTransform: "uppercase", color: "#a5b4fc" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#6366f1" }} />
                    {APP_NAME}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
                    <div style={{ fontSize: 78, lineHeight: 1.05, fontWeight: 700 }}>
                        Paste any guide. Get a full interactive workspace.
                    </div>
                    <div style={{ fontSize: 30, lineHeight: 1.4, color: "#cbd5e1" }}>{APP_TAGLINE}</div>
                </div>
                <div style={{ fontSize: 22, color: "#94a3b8" }}>
                    AI-generated modules, tasks, notes, resources, progress tracking, and exports.
                </div>
            </div>
        ),
        size,
    );
}

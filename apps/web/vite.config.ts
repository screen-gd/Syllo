import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    server: {
        port: 3000,
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    ssr: {
        // better-sqlite3 ships a native addon; it must stay external instead
        // of being pulled through the SSR bundle.
        external: ["better-sqlite3"],
    },
    plugins: [
        tailwindcss(),
        tanstackStart({
            srcDirectory: "src",
            router: {
                routesDirectory: "routes",
            },
        }),
        viteReact(),
    ],
});

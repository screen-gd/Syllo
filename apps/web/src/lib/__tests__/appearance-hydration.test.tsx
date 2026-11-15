// @vitest-environment happy-dom
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import AppearanceSettings from "@/components/settings/AppearanceSettings";
import { THEME_STORAGE_KEY } from "@/lib/appearance";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root | undefined;

afterEach(() => {
    if (root) act(() => root!.unmount());
    root = undefined;
    container?.remove();
    localStorage.clear();
});

describe("AppearanceSettings hydration", () => {
    it("renders 'system' on the server so hydration attributes match", () => {
        const html = renderToString(<AppearanceSettings />);
        const doc = new DOMParser().parseFromString(html, "text/html");
        const checked = doc.querySelector(
            "[data-slot='segmented-control-item'][aria-checked='true']",
        );
        expect(checked?.textContent).toBe("System");
    });

    it("settles to the stored dark preference after hydrating server markup", async () => {
        const html = renderToString(<AppearanceSettings />);
        container = document.createElement("div");
        container.innerHTML = html;
        document.body.appendChild(container);
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify("dark"));
        await act(async () => {
            root = hydrateRoot(container, <AppearanceSettings />);
        });
        const items = [
            ...container.querySelectorAll<HTMLElement>(
                "[data-slot='segmented-control-item']",
            ),
        ];
        const byText = (text: string) =>
            items.find((item) => item.textContent === text);
        expect(byText("Dark")?.getAttribute("aria-checked")).toBe("true");
        expect(byText("System")?.getAttribute("aria-checked")).toBe("false");
        expect(byText("Dark")?.hasAttribute("data-checked")).toBe(true);
    });
});

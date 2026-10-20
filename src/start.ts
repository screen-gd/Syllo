import { createStart } from "@tanstack/react-start";
import { gateMiddleware } from "@/lib/server/gate";

export const startInstance = createStart(() => ({
    requestMiddleware: [gateMiddleware],
}));

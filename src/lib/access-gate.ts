/* Server-side access gate (password lock) */

import { createHash, timingSafeEqual } from "node:crypto";

export const GATE_COOKIE = "zns_gate_unlocked";
export const GATE_COOKIE_VALUE = "1";
export const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function getGatePassword(): string {
    return process.env.GATE_PASSWORD ?? "";
}

/** Constant-time password comparison. */
export function isGatePasswordValid(attempt: string): boolean {
    const expected = getGatePassword();
    if (!expected) {
        return false;
    }
    const a = createHash("sha256").update(attempt).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
}

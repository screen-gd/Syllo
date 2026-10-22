import { getScoutAccessToken } from "./scout/api-client";

/** Keep the existing workspace APIs usable when private sync is connected. */
export function fetchPrivateApi(path: `/api/${string}`, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    const token = getScoutAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(path, { ...init, headers });
}

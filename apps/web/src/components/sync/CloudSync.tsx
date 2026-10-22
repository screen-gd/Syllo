import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    ConvexAuthProvider,
    useAuthActions,
    useAuthToken,
} from "@convex-dev/auth/react";
import {
    ConvexReactClient,
    useConvexAuth,
    useMutation,
    useQuery,
} from "convex/react";
import { z } from "zod";
import { cloudApi } from "@/lib/personal/cloud-api";
import {
    personalEntrySchema,
    type LibraryBook,
    type PersonalEntry,
} from "@/lib/personal/schema";
import {
    getPersonalSnapshot,
    mergePersonalEntries,
    personalEntries,
    putPersonalEntry,
    usePersonalData,
} from "@/lib/personal/store";
import { getLocalFile } from "@/lib/personal/files";
import { findBook, updateBook } from "@/lib/personal/books";
import { getStorage } from "@/lib/storage";
import { WORKSPACE_CHANGE_EVENT } from "@/lib/workspace-persistence";
import { setScoutAccessToken } from "@/lib/scout/api-client";

type SyncStatus = "local" | "signed-out" | "connecting" | "connected";
interface SyncContext {
    status: SyncStatus;
    error: string | null;
    signIn?: (form: FormData) => Promise<unknown>;
    signOut?: () => Promise<void>;
    uploadBook: (book: LibraryBook) => Promise<void>;
    downloadFile?: (id: string) => Promise<Blob>;
}
const localSync: SyncContext = {
    status: "local",
    error: null,
    uploadBook: async () => {},
};
const Context = createContext<SyncContext>(localSync);
export const useCloudSync = () => useContext(Context);
const url =
    typeof import.meta.env.VITE_CONVEX_URL === "string"
        ? import.meta.env.VITE_CONVEX_URL.trim()
        : "";

/** Old roadmap ids and browser progress remain readable throughout the transition. */
function LocalBridge() {
    const records = usePersonalData();
    const importing = useRef(false);
    useEffect(() => {
        function capture() {
            if (importing.current) return;
            const original = localStorage.getItem("zns:v2:workspace-state");
            if (
                original &&
                !localStorage.getItem("syllo:workspace-before-personal-v1")
            )
                localStorage.setItem(
                    "syllo:workspace-before-personal-v1",
                    original,
                );
            const storage = getStorage();
            const snapshot = getPersonalSnapshot();
            const roadmaps = storage.getRoadmaps();
            for (const roadmap of roadmaps) {
                const previous = snapshot[`roadmap:${roadmap.id}`];
                if (
                    !previous ||
                    previous.kind !== "roadmap" ||
                    previous.deleted ||
                    JSON.stringify(previous.data) !== JSON.stringify(roadmap)
                ) {
                    const parsed = personalEntrySchema.safeParse({
                        kind: "roadmap",
                        id: `roadmap:${roadmap.id}`,
                        data: roadmap,
                        updatedAt: Date.now(),
                        deleted: false,
                    });
                    if (parsed.success) putPersonalEntry(parsed.data);
                }
                for (const review of storage.getReviews(roadmap.id)) {
                    const previousReview = snapshot[`review:${review.id}`];
                    if (
                        previousReview?.kind === "review" &&
                        JSON.stringify(previousReview.data) ===
                            JSON.stringify(review)
                    )
                        continue;
                    const parsed = personalEntrySchema.safeParse({
                        kind: "review",
                        id: `review:${review.id}`,
                        data: review,
                        updatedAt: Date.now(),
                        deleted: false,
                    });
                    if (parsed.success) putPersonalEntry(parsed.data);
                }
            }
            for (const entry of personalEntries(snapshot, "roadmap")) {
                if (!roadmaps.some((roadmap) => roadmap.id === entry.data.id))
                    putPersonalEntry({ ...entry, deleted: true });
            }
        }
        capture();
        window.addEventListener(WORKSPACE_CHANGE_EVENT, capture);
        return () =>
            window.removeEventListener(WORKSPACE_CHANGE_EVENT, capture);
    }, []);
    useEffect(() => {
        importing.current = true;
        try {
            const storage = getStorage();
            for (const entry of Object.values(records)) {
                if (entry.kind === "roadmap") {
                    const current = storage.getRoadmap(entry.data.id);
                    if (entry.deleted) {
                        if (current) storage.deleteRoadmap(entry.data.id);
                    } else if (
                        JSON.stringify(current) !== JSON.stringify(entry.data)
                    )
                        storage.saveRoadmap(entry.data);
                }
                if (
                    entry.kind === "review" &&
                    !entry.deleted &&
                    storage.getRoadmap(entry.data.roadmapId)
                ) {
                    const existing = storage.getReviews(entry.data.roadmapId);
                    const current = existing.find(
                        (item) => item.id === entry.data.id,
                    );
                    if (JSON.stringify(current) !== JSON.stringify(entry.data))
                        storage.saveReviews(entry.data.roadmapId, [
                            ...existing.filter(
                                (item) => item.id !== entry.data.id,
                            ),
                            entry.data,
                        ]);
                }
            }
        } finally {
            importing.current = false;
        }
    }, [records]);
    return null;
}

function ConnectedSync({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const token = useAuthToken();
    const { signIn, signOut } = useAuthActions();
    const remote = useQuery(cloudApi.list, isAuthenticated ? {} : "skip");
    const write = useMutation(cloudApi.write);
    const createUpload = useMutation(cloudApi.uploadUrl);
    const registerFile = useMutation(cloudApi.registerFile);
    const records = usePersonalData();
    const [error, setError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const syncing = useRef(false);
    useEffect(() => {
        setScoutAccessToken(token);
        return () => setScoutAccessToken(null);
    }, [token]);
    useEffect(() => {
        if (!remote) return;
        const incoming: PersonalEntry[] = [];
        try {
            for (const item of remote)
                incoming.push(
                    personalEntrySchema.parse(JSON.parse(item.payload)),
                );
            mergePersonalEntries(incoming);
        } catch {
            setError(
                "A synced record could not be read. Your local data has been kept.",
            );
        }
    }, [remote]);
    useEffect(() => {
        if (!remote || !isAuthenticated) return;
        const revisions = new Map(
            remote.map((item) => [item.key, item.updatedAt]),
        );
        const changes = Object.values(records).filter(
            (item) => item.updatedAt > (revisions.get(item.id) ?? -1),
        );
        if (!changes.length) return;
        let cancelled = false;
        const attempt = setTimeout(async () => {
            if (syncing.current) {
                if (!cancelled) setRetry((value) => value + 1);
                return;
            }
            syncing.current = true;
            try {
                for (let index = 0; index < changes.length; index += 20) {
                    if (cancelled) break;
                    await write({
                        entries: changes
                            .slice(index, index + 20)
                            .map((item) => ({
                                key: item.id,
                                payload: JSON.stringify(item),
                                updatedAt: item.updatedAt,
                            })),
                    });
                }
                if (!cancelled) setError(null);
            } catch {
                if (!cancelled)
                    setError(
                        "Sync is paused. Changes are saved on this device and will retry.",
                    );
            } finally {
                syncing.current = false;
            }
        }, 500);
        const retryTimer = setTimeout(
            () => setRetry((value) => value + 1),
            30_000,
        );
        return () => {
            cancelled = true;
            clearTimeout(attempt);
            clearTimeout(retryTimer);
        };
    }, [records, remote, isAuthenticated, write, retry]);
    const downloadFile = useCallback(
        async (id: string) => {
            if (!token) throw new Error("Sign in to download this book.");
            const site =
                typeof import.meta.env.VITE_CONVEX_SITE_URL === "string" &&
                import.meta.env.VITE_CONVEX_SITE_URL
                    ? import.meta.env.VITE_CONVEX_SITE_URL
                    : url.replace(/\.convex\.cloud\/?$/, ".convex.site");
            const response = await fetch(
                `${site}/library/file?id=${encodeURIComponent(id)}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!response.ok)
                throw new Error(
                    "Could not download this book. Check your connection and sign-in.",
                );
            return response.blob();
        },
        [token],
    );
    const uploadBook = useCallback(
        async (book: LibraryBook) => {
            if (!isAuthenticated) return;
            const current = findBook(book.id) ?? book;
            async function upload(key: string) {
                const file = await getLocalFile(key);
                if (!file) return null;
                const upload = await createUpload();
                const response = await fetch(upload, {
                    method: "POST",
                    headers: {
                        "Content-Type": file.type || "application/epub+zip",
                    },
                    body: file,
                });
                if (!response.ok)
                    throw new Error(
                        "The book is saved locally, but its cloud upload failed.",
                    );
                const result = z
                    .object({ storageId: z.string() })
                    .parse(await response.json());
                // The server revalidates the storage id and ownership at registration.
                const storageId = await registerFile({
                    storageId: result.storageId,
                });
                return storageId;
            }
            const cloudFileId =
                current.cloudFileId ?? (await upload(current.fileKey));
            const cloudCoverId =
                current.cloudCoverId ??
                (current.coverKey ? await upload(current.coverKey) : null);
            updateBook(current.id, { cloudFileId, cloudCoverId });
        },
        [isAuthenticated, createUpload, registerFile],
    );
    const value: SyncContext = {
        status: isLoading
            ? "connecting"
            : !isAuthenticated
              ? "signed-out"
              : !remote
                ? "connecting"
                : "connected",
        error,
        signIn: (form) => signIn("password", form),
        signOut,
        uploadBook,
        downloadFile,
    };
    return <Context.Provider value={value}>{children}</Context.Provider>;
}

export default function CloudSync({ children }: { children: ReactNode }) {
    const client = useMemo(() => (url ? new ConvexReactClient(url) : null), []);
    useEffect(
        () => () => {
            void client?.close();
        },
        [client],
    );
    const contents = (
        <>
            <LocalBridge />
            {children}
        </>
    );
    return client ? (
        <ConvexAuthProvider client={client}>
            <ConnectedSync>{contents}</ConnectedSync>
        </ConvexAuthProvider>
    ) : (
        <Context.Provider value={localSync}>{contents}</Context.Provider>
    );
}

const DATABASE = "syllo-library";
const STORE = "files";
let database: Promise<IDBDatabase> | null = null;

function openDatabase() {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            database = null;
            reject(new Error("Book storage is unavailable in this browser."));
        };
    });
    return database;
}

export async function saveLocalFile(key: string, file: Blob) {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE, "readwrite");
        transaction.objectStore(STORE).put(file, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
            reject(new Error("There is not enough space to save this book."));
        transaction.onabort = () =>
            reject(
                new Error(
                    "The book could not be saved. Free some storage and try again.",
                ),
            );
    });
}

export async function getLocalFile(key: string): Promise<Blob | null> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE).objectStore(STORE).get(key);
        request.onsuccess = () =>
            resolve(request.result instanceof Blob ? request.result : null);
        request.onerror = () =>
            reject(new Error("Could not open this book’s cached file."));
    });
}

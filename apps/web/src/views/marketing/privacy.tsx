export function PrivacyView() {
    return (
        <section className="mx-auto w-full max-w-4xl px-6 py-20 md:py-24">
            <h1 className="font-display text-4xl text-text">Privacy Policy</h1>
            <div className="mt-8 space-y-6 text-sm leading-7 text-text-muted">
                <p>Syllo stores your books, progress, notes and review cards in this browser. Scout keeps its drafts and source text in a local SQLite file on the machine that runs the app.</p>
                <p>If you connect your own Convex deployment, your records and books sync to that deployment. Syllo has no shared server or account system of its own.</p>
                <p>AI keys stay in browser storage or the local worker&apos;s environment. They are sent only to the selected AI provider to fulfil a request.</p>
                <p>Settings exports your data as a backup. Clearing site data in your browser deletes the local copy.</p>
            </div>
        </section>
    );
}

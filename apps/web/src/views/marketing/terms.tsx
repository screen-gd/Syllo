export function TermsView() {
    return (
        <section className="mx-auto w-full max-w-measure px-4 py-10 sm:px-6">
            <h1 className="type-title">Terms of use</h1>
            <div className="mt-6 flex flex-col gap-4 type-body text-text-2">
                <p>This product is provided as a workspace and content-structuring tool. You are responsible for the source material, generated outputs, and any third-party services you connect.</p>
                <p>Syllo stores your data in your browser, or in your own Convex deployment if you connect one. There is no shared Syllo server.</p>
                <p>Use of the product must comply with applicable law and the terms of any upstream services you configure.</p>
            </div>
        </section>
    );
}

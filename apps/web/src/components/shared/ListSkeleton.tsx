/** Placeholder rows shown while a list page reads the learner's saved data. */
export default function ListSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="sy-skeleton-list" role="status" aria-label="Loading">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="sy-skeleton-row">
                    <span className="skeleton" style={{ width: "32%" }} />
                    <span className="skeleton" style={{ width: "78%" }} />
                </div>
            ))}
        </div>
    );
}

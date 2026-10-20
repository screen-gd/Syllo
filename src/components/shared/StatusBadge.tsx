interface StatusBadgeProps {
    status: "pending" | "submitted" | "approved" | "revision";
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-500/10", text: "text-warning", label: "Pending" },
    submitted: { bg: "bg-blue-500/10", text: "text-info", label: "Submitted" },
    approved: { bg: "bg-emerald-500/10", text: "text-success", label: "Approved" },
    revision: { bg: "bg-red-500/10", text: "text-error", label: "Needs Revision" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
    const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
            {style.label}
        </span>
    );
}

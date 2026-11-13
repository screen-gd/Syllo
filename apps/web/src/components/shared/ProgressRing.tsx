interface ProgressRingProps {
    percent: number;
    size?: number;
    strokeWidth?: number;
    className?: string;
}

export default function ProgressRing({
    percent,
    size = 56,
    strokeWidth = 4,
    className = "",
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            {/* Animate wrapper div, not SVG directly (vercel best practice: 6.1) */}
            <div className="transition-transform duration-300">
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    fill="none"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${percent}% complete`}
                >
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="var(--color-surface-muted)"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="var(--color-accent)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        style={{
                            transition:
                                "stroke-dashoffset var(--dur-base) var(--ease-out)",
                        }}
                    />
                </svg>
            </div>
            {/* Percentage text */}
            <span className="absolute text-[0.75rem] font-bold font-display text-text tabular-nums">
                {percent}%
            </span>
        </div>
    );
}

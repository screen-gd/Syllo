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
                        stroke="var(--color-obsidian-elevated)"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="url(#progress-gradient)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                    />
                    <defs>
                        <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--color-indigo-glow)" />
                            <stop offset="100%" stopColor="var(--color-violet-accent)" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            {/* Percentage text */}
            <span className="absolute text-[12px] font-bold font-display text-text-primary tabular-nums">
                {percent}%
            </span>
        </div>
    );
}

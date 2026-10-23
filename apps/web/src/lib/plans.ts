export const PLANS = {
    free: {
        id: "free",
        name: "Free",
        monthlyPrice: 0,
        annualPrice: 0,
        currency: "usd",
        limits: {
            workspaces: 3,
            aiGenerations: 10,
        },
        features: [
            "3 workspaces",
            "10 AI generations / month",
            "All section types",
            "Export to MD & JSON",
            "ZNS watermark on embeds",
            "Community support",
        ],
        notIncluded: [
            "Remove watermark",
            "Custom branding",
            "Unlimited workspaces",
            "White-label embedding",
        ],
    },
    pro: {
        id: "pro",
        name: "Pro",
        monthlyPrice: 12,
        annualPrice: 99,
        currency: "usd",
        limits: {
            workspaces: -1,
            aiGenerations: -1,
        },
        features: [
            "Unlimited workspaces",
            "Unlimited AI generations",
            "Remove ZNS watermark",
            "Custom accent color",
            "Version history (5 versions)",
            "Export to PDF",
            "Bring your own API key",
            "Priority support",
        ],
        notIncluded: [
            "White-label embedding",
            "Client workspace management",
            "Admin analytics",
        ],
    },
    agency: {
        id: "agency",
        name: "Agency",
        monthlyPrice: 59,
        annualPrice: 490,
        currency: "usd",
        limits: {
            workspaces: -1,
            aiGenerations: -1,
        },
        features: [
            "Everything in Pro",
            "White-label embedding",
            "Custom logo & branding",
            "Client workspace management",
            "Intern review system",
            "Admin analytics dashboard",
            "Priority & dedicated support",
            "Early access to new features",
        ],
        notIncluded: [],
    },
} as const

export type PlanId = keyof typeof PLANS
export type BillingInterval = "monthly" | "annual"

export function getPaidPlanIds() {
    return ["pro", "agency"] as const
}

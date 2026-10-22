import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./model";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
    providers: [
        Password<DataModel>({
            profile(params) {
                const email =
                    typeof params.email === "string"
                        ? params.email.trim().normalize("NFKC").toLowerCase()
                        : "";
                const owner = process.env.SYLLO_OWNER_EMAIL?.trim()
                    .normalize("NFKC")
                    .toLowerCase();
                if (!owner)
                    throw new Error(
                        "Set SYLLO_OWNER_EMAIL on the Convex deployment before signing in.",
                    );
                if (email !== owner)
                    throw new Error("This is a private learning space.");
                return { email };
            },
        }),
    ],
});

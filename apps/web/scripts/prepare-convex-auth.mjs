import { generateKeyPairSync } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

if (process.argv.includes("--help")) {
    process.stdout.write(
        "Generate Convex Auth signing keys into .env.convex-auth.local without contacting a deployment. Existing keys are never overwritten.\n",
    );
} else {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
    });
    const pem = privateKey
        .export({ type: "pkcs8", format: "pem" })
        .toString()
        .trimEnd()
        .replace(/\n/g, " ");
    const jwks = JSON.stringify({
        keys: [{ use: "sig", ...publicKey.export({ format: "jwk" }) }],
    });
    const path = resolve(import.meta.dirname, "../.env.convex-auth.local");
    try {
        await writeFile(path, `JWT_PRIVATE_KEY="${pem}"\nJWKS=${jwks}\n`, {
            flag: "wx",
            mode: 0o600,
        });
        process.stdout.write(
            "Created .env.convex-auth.local. Keep it private. Follow docs/syllo-setup.md to configure your deployment.\n",
        );
    } catch (error) {
        if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "EEXIST"
        ) {
            process.stderr.write(
                ".env.convex-auth.local already exists; its keys were kept.\n",
            );
            process.exitCode = 1;
        } else throw error;
    }
}

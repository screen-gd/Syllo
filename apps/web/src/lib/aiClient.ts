import { isAiProvider } from "@/lib/ai-config";
import { generateStructuredJson } from "@/lib/server/ai";

export async function generateStructuredContent(
    prompt: string,
    userKey?: string,
    userProvider?: string,
    userModel?: string,
): Promise<string> {
    return generateStructuredJson(prompt, {
        apiKey: userKey,
        model: userModel,
        provider: isAiProvider(userProvider) ? userProvider : "gemini",
    });
}

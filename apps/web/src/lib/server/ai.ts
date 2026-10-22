import { AiRequestOptions } from "@/lib/ai-config";
import { createAiClient, resolveAiRequestOptions, truncateForAi } from "@/lib/openai";

export async function testAiConnection(options?: AiRequestOptions) {
    await generateStructuredJson('Return only valid JSON: {"ok": true}', options);
}

export async function generateStructuredJson(prompt: string, options?: AiRequestOptions) {
    const client = createAiClient(options);
    const { model } = resolveAiRequestOptions(options);
    const completion = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: truncateForAi(prompt) }],
        temperature: 0.3,
        response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
        throw new Error("The AI provider returned an empty response");
    }

    return content;
}

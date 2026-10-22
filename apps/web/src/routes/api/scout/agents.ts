import { createFileRoute } from "@tanstack/react-router";
import { agentConnections, agentStatuses, researchWithAgent, type AgentId } from "@/lib/scout/agent-runner";
import { readJsonBody, scoutBadRequest, scoutFailure, scoutJson } from "@/lib/scout/http";
import { addManualResource } from "@/lib/scout/library";

const AGENT_IDS: AgentId[] = ["opencode", "codex", "claude"];

export const Route = createFileRoute("/api/scout/agents")({
    server: {
        handlers: {
            /** Which agent CLIs exist on this machine, plus MCP config snippets. */
            GET: async () => {
                try {
                    const agents = await agentStatuses();
                    return scoutJson({ success: true, agents, connections: agentConnections() });
                } catch (error) {
                    return scoutFailure(error, "Scout could not check your agents");
                }
            },
            /**
             * Ask one agent for free resources for a goal, then save the links
             * the agent returned. Only validated titles and http(s) URLs reach
             * the library; the agent never sees Scout keys or the transcript.
             */
            POST: async ({ request }) => {
                try {
                    const body = await readJsonBody<{ goal?: unknown; agent?: unknown }>(request);
                    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
                    if (goal.length < 3) return scoutBadRequest("Describe what you want to learn first.");
                    if (goal.length > 500) return scoutBadRequest("Keep the goal under 500 characters.");

                    const requested = typeof body?.agent === "string" ? (body.agent as AgentId) : null;
                    const agentId = requested && AGENT_IDS.includes(requested) ? requested : null;

                    const result = await researchWithAgent(goal, agentId);
                    const saved = [];
                    const skipped: string[] = [];

                    for (const resource of result.resources) {
                        try {
                            saved.push(
                                addManualResource({
                                    url: resource.url,
                                    title: resource.title,
                                    note: resource.note ?? `Found by ${result.agent.label} for “${goal}”.`,
                                    skills: resource.skill ? [resource.skill] : undefined,
                                }),
                            );
                        } catch (error) {
                            skipped.push(`${resource.url}: ${error instanceof Error ? error.message : "rejected"}`);
                        }
                    }

                    return scoutJson({
                        success: true,
                        agent: result.agent,
                        resources: saved,
                        skipped,
                    });
                } catch (error) {
                    return scoutFailure(error, "That agent could not finish the research");
                }
            },
        },
    },
});

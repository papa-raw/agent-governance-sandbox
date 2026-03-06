import type { AgentAction, AgentState, SimulationState } from '../../types';
import { AgentActionSchema } from '../../types';
import { getClient, isLLMAvailable, isOpenRouter } from './client';
import { buildSystemPrompt, buildContextPrompt } from './prompts';

/**
 * Cache of system prompts per agent ID (they don't change between rounds).
 */
const systemPromptCache = new Map<string, string>();

/**
 * Generate actions for all active agents using the LLM runtime.
 * Falls back to the provided deterministicFallback if LLM is unavailable.
 */
export async function generateLLMActions(
  state: SimulationState,
  deterministicFallback: (state: SimulationState) => AgentAction[],
): Promise<AgentAction[]> {
  if (!isLLMAvailable()) {
    return deterministicFallback(state);
  }

  const activeAgents = state.agents.filter((a) => !a.excluded && !a.suspended);
  const fallbackActions = deterministicFallback(state);
  const actions: AgentAction[] = [];

  // Sequential calls with delay to avoid 429 rate limits
  for (const agent of activeAgents) {
    try {
      const action = await generateAgentAction(agent, state);
      if (action) {
        actions.push(action);
      } else {
        const fallback = fallbackActions.find((a) => a.agentId === agent.id);
        if (fallback) actions.push(fallback);
      }
    } catch {
      const fallback = fallbackActions.find((a) => a.agentId === agent.id);
      if (fallback) actions.push(fallback);
    }
    // Small delay between calls to stay under rate limits
    if (activeAgents.length > 3) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return actions;
}

/**
 * Generate a single agent's action via Claude.
 */
async function generateAgentAction(
  agent: AgentState,
  state: SimulationState,
): Promise<AgentAction | null> {
  const client = getClient();
  if (!client) return null;

  // Cache system prompts — they don't change between rounds
  if (!systemPromptCache.has(agent.id)) {
    systemPromptCache.set(agent.id, buildSystemPrompt(agent));
  }

  const systemPrompt = systemPromptCache.get(agent.id)!;
  const contextPrompt = buildContextPrompt(agent, state);

  try {
    const response = await client.messages.create({
      model: isOpenRouter() ? 'anthropic/claude-haiku-4-5-20251001' : 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: contextPrompt }],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('');

    return parseAndValidateAction(text, agent);
  } catch (error) {
    console.warn(`LLM call failed for ${agent.name}:`, error);
    return null;
  }
}

/**
 * Parse and validate the LLM response into an AgentAction.
 * Extracts JSON from potential markdown code fences, validates with Zod.
 */
function parseAndValidateAction(
  responseText: string,
  agent: AgentState,
): AgentAction | null {
  try {
    // Strip markdown code fences if present
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    // The response might be { action: { ... } } or just { ... }
    const actionObj = parsed.action ?? parsed;

    // Add agentId and validate
    const withId = { ...actionObj, agentId: agent.id };

    // Sanitize targetZones — LLM may return zone names instead of UUIDs; strip them
    if (withId.targetZones && Array.isArray(withId.targetZones)) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
      const validZones = withId.targetZones.filter((z: string) => uuidPattern.test(z));
      withId.targetZones = validZones.length > 0 ? validZones : undefined;
    }

    // Convert propose_rule to abstain if no proper proposal object
    if (withId.type === 'propose_rule' && !withId.proposal) {
      withId.type = 'abstain';
      withId.reasoning = withId.reasoning || 'Considered proposing a rule change but held off.';
    }

    const validated = AgentActionSchema.parse(withId);

    // Enforce authority bounds
    if (validated.type === 'consume' && validated.amount !== undefined) {
      validated.amount = Math.min(
        validated.amount,
        agent.delegationConfig.authorityBounds.maxConsume,
      );
    }

    if (validated.type === 'propose_rule' && !agent.delegationConfig.authorityBounds.canPropose) {
      return {
        agentId: agent.id,
        type: 'abstain',
        reasoning: `${agent.name} attempted to propose but lacks authority — abstaining instead.`,
      };
    }

    return validated as AgentAction;
  } catch (error) {
    console.warn(`Failed to parse LLM response for ${agent.name}:`, error);
    console.warn('Raw response:', responseText);
    return null;
  }
}

/**
 * Clear cached system prompts (e.g., when starting a new simulation).
 */
export function clearPromptCache(): void {
  systemPromptCache.clear();
}

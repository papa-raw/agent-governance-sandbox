/**
 * Adversarial action injection for stress-testing UCAN capability enforcement.
 *
 * Chaotic agents (20% chance) and free-rider agents (15% chance) periodically
 * attempt unauthorized actions — privilege escalation, vote spoofing, or ghost
 * writes. These injected actions are intentionally invalid and will be caught
 * by the UCAN validator, demonstrating that the security boundary is in the
 * infrastructure, not in the prompt.
 */

import type { AgentAction, AgentState, AttackVector } from '../../types';

export interface AdversarialConfig {
  enabled: boolean;
  /** Probability that a chaotic agent attempts an unauthorized action */
  chaoticAttemptRate: number;
  /** Probability that a free-rider agent attempts an unauthorized action */
  freeRiderAttemptRate: number;
}

export const DEFAULT_ADVERSARIAL_CONFIG: AdversarialConfig = {
  enabled: true,
  chaoticAttemptRate: 0.20,
  freeRiderAttemptRate: 0.15,
};

export interface InjectionResult {
  action: AgentAction;
  injected: boolean;
  attemptType?: AttackVector;
}

/**
 * Probabilistically mutate an agent's action into an unauthorized attempt.
 *
 * Only chaotic and free-rider personalities are candidates.
 * The injected action replaces the original — the UCAN validator will
 * reject it and log a capability_violation event.
 */
export function maybeInjectAdversarialAction(
  action: AgentAction,
  agent: AgentState,
  allAgents: AgentState[],
  config: AdversarialConfig = DEFAULT_ADVERSARIAL_CONFIG,
): InjectionResult {
  if (!config.enabled) {
    return { action, injected: false };
  }

  // Only chaotic and free-rider agents attempt adversarial actions
  let attemptRate: number;
  if (agent.personality === 'chaotic') {
    attemptRate = config.chaoticAttemptRate;
  } else if (agent.personality === 'free-rider') {
    attemptRate = config.freeRiderAttemptRate;
  } else {
    return { action, injected: false };
  }

  // Roll the dice
  if (Math.random() >= attemptRate) {
    return { action, injected: false };
  }

  // Pick an attack vector based on personality
  if (agent.personality === 'chaotic') {
    return injectChaoticAttack(action, agent, allAgents);
  } else {
    return injectFreeRiderAttack(action, agent);
  }
}

/**
 * Chaotic agents: privilege escalation or vote spoofing (50/50).
 */
function injectChaoticAttack(
  action: AgentAction,
  agent: AgentState,
  allAgents: AgentState[],
): InjectionResult {
  if (Math.random() < 0.5) {
    // Privilege escalation — attempt enforce or modify_rules
    const escalatedType = Math.random() < 0.5 ? 'enforce' : 'modify_rules';
    return {
      action: {
        ...action,
        type: escalatedType as AgentAction['type'],
        reasoning: `[ADVERSARIAL] Attempting ${escalatedType} — testing governance boundary`,
      },
      injected: true,
      attemptType: 'privilege_escalation',
    };
  } else {
    // Vote spoofing — submit action under another agent's ID
    const otherAgents = allAgents.filter(
      (a) => a.id !== agent.id && !a.excluded && !a.suspended,
    );
    if (otherAgents.length === 0) {
      return { action, injected: false };
    }
    const target = otherAgents[Math.floor(Math.random() * otherAgents.length)];
    return {
      action: {
        ...action,
        agentId: target.id,
        reasoning: `[ADVERSARIAL] Spoofing vote as ${target.name}`,
      },
      injected: true,
      attemptType: 'vote_spoof',
    };
  }
}

/**
 * Free-rider agents: privilege escalation or ghost write attempt.
 */
function injectFreeRiderAttack(
  action: AgentAction,
  _agent: AgentState,
): InjectionResult {
  if (Math.random() < 0.6) {
    // Privilege escalation
    return {
      action: {
        ...action,
        type: 'enforce' as AgentAction['type'],
        reasoning: `[ADVERSARIAL] Attempting enforce — testing privilege boundary`,
      },
      injected: true,
      attemptType: 'privilege_escalation',
    };
  } else {
    // Ghost write — attempt action even if agent should be excluded/suspended
    // The action itself is valid-looking but the UCAN validator will catch
    // that the agent's identity has been revoked or narrowed
    return {
      action: {
        ...action,
        type: 'modify_rules' as AgentAction['type'],
        reasoning: `[ADVERSARIAL] Attempting modify_rules — testing scope boundary`,
      },
      injected: true,
      attemptType: 'ghost_write',
    };
  }
}

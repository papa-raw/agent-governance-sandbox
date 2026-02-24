/**
 * UCAN capability validation for agent actions.
 *
 * Maps each AgentActionType to a required AgentCapability, then checks
 * the agent's identity to determine if the action is authorized.
 * Also detects vote spoofing (action.agentId !== source agent's id).
 */

import type {
  AgentAction,
  AgentActionType,
  AgentCapability,
  AgentState,
  CapabilityViolation,
  GovernanceEvent,
} from '../../types';

/** Maps action types to the capability required to perform them */
const ACTION_CAPABILITY_MAP: Record<AgentActionType, AgentCapability> = {
  consume: 'consume',
  contribute: 'contribute',
  propose_rule: 'propose',
  vote: 'vote',
  abstain: 'vote',
  enforce: 'enforce',
  modify_rules: 'modify_rules',
};

export { ACTION_CAPABILITY_MAP };

interface ValidationResult {
  authorized: boolean;
  violation?: CapabilityViolation;
}

/**
 * Check whether an agent's identity grants the capability required
 * for the given action type.
 */
export function validateCapability(
  action: AgentAction,
  agent: AgentState,
): ValidationResult {
  if (!isUCANEnabled()) return { authorized: true };

  const identity = agent.identity;
  if (!identity) return { authorized: true }; // No identity = pre-UCAN mode

  // Revoked identity blocks everything
  if (identity.revoked) {
    return {
      authorized: false,
      violation: {
        attackVector: 'ghost_write',
        attemptedBy: identity.did,
        attemptedAction: action.type,
        rejectionReason: `DID ${identity.did.slice(0, 20)}... has been revoked (excluded agent)`,
        agentId: agent.id,
        agentName: agent.name,
      },
    };
  }

  const requiredCapability = ACTION_CAPABILITY_MAP[action.type];
  if (!requiredCapability) return { authorized: true };

  if (!identity.capabilities.includes(requiredCapability)) {
    return {
      authorized: false,
      violation: {
        attackVector: 'privilege_escalation',
        attemptedBy: identity.did,
        attemptedAction: action.type,
        rejectionReason: `Capability '${requiredCapability}' not in delegation scope [${identity.capabilities.join(', ')}]`,
        agentId: agent.id,
        agentName: agent.name,
      },
    };
  }

  return { authorized: true };
}

/**
 * Detect vote spoofing: an action's agentId doesn't match the source agent.
 * This catches attempts where a chaotic agent submits an action claiming
 * to be a different agent.
 */
export function validateIdentityBinding(
  action: AgentAction,
  sourceAgent: AgentState,
  allAgents: AgentState[],
): ValidationResult {
  if (!isUCANEnabled()) return { authorized: true };
  if (!sourceAgent.identity) return { authorized: true };

  if (action.agentId !== sourceAgent.id) {
    const targetAgent = allAgents.find((a) => a.id === action.agentId);
    return {
      authorized: false,
      violation: {
        attackVector: 'vote_spoof',
        attemptedBy: sourceAgent.identity.did,
        attemptedAction: action.type,
        rejectionReason: `DID binding mismatch: ${sourceAgent.name} attempted action as ${targetAgent?.name ?? action.agentId.slice(0, 8)}`,
        agentId: sourceAgent.id,
        agentName: sourceAgent.name,
      },
    };
  }

  return { authorized: true };
}

/**
 * Create a GovernanceEvent from a capability violation.
 */
export function createViolationEvent(
  violation: CapabilityViolation,
  round: number,
): GovernanceEvent {
  return {
    type: 'capability_violation',
    round,
    timestamp: new Date().toISOString(),
    details: {
      attackVector: violation.attackVector,
      attemptedBy: violation.attemptedBy,
      attemptedAction: violation.attemptedAction,
      rejectionReason: violation.rejectionReason,
      agentId: violation.agentId,
      agentName: violation.agentName,
    },
  };
}

/**
 * Check if UCAN enforcement is enabled via environment variable.
 * Defaults to true — set VITE_UCAN_ENABLED=false to disable.
 */
export function isUCANEnabled(): boolean {
  const flag = import.meta.env.VITE_UCAN_ENABLED;
  if (flag === 'false' || flag === '0') return false;
  return true;
}

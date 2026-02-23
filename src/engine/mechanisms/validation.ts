import type { AgentAction, AgentState, SimulationState } from '../../types';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate an agent action against governance rules.
 * Returns valid: true if action is permitted, or valid: false with reason.
 */
export function validateAction(
  action: AgentAction,
  agent: AgentState,
  state: SimulationState,
): ValidationResult {
  const gov = state.governance;

  // Excluded or suspended agents cannot act
  if (agent.excluded) {
    return { valid: false, reason: 'Agent is excluded from governance' };
  }
  if (agent.suspended && state.round < (agent.suspendedUntilRound ?? Infinity)) {
    return { valid: false, reason: `Agent is suspended until round ${agent.suspendedUntilRound}` };
  }

  // Check boundary rules
  if (gov.boundaryRules.enabled) {
    const activeAgents = state.agents.filter((a) => !a.excluded);
    if (activeAgents.length > gov.boundaryRules.maxAgents) {
      return { valid: false, reason: 'Governance territory is at capacity' };
    }
  }

  // Validate by action type
  switch (action.type) {
    case 'consume':
      return validateConsume(action, agent, state);
    case 'contribute':
      return validateContribute(action, agent);
    case 'propose_rule':
      return validateProposal(action, agent, state);
    case 'vote':
      return validateVote(action, agent, state);
    case 'abstain':
      return { valid: true };
    default:
      return { valid: false, reason: `Unknown action type: ${action.type}` };
  }
}

function validateConsume(
  action: AgentAction,
  agent: AgentState,
  state: SimulationState,
): ValidationResult {
  const amount = action.amount ?? 0;
  if (amount <= 0) {
    return { valid: false, reason: 'Consume amount must be positive' };
  }

  // Check authority bounds from delegation config
  if (amount > agent.delegationConfig.authorityBounds.maxConsume) {
    return {
      valid: false,
      reason: `Consume amount ${amount} exceeds delegation authority bound of ${agent.delegationConfig.authorityBounds.maxConsume}`,
    };
  }

  // Check if target zones have enough resources
  const targetZones = action.targetZones ?? [];
  for (const zoneId of targetZones) {
    const zone = state.commons.territory.zones.find((z) => z.id === zoneId);
    if (!zone) {
      return { valid: false, reason: `Zone ${zoneId} not found` };
    }
    if (zone.steward !== agent.id && zone.steward !== 'commons') {
      return { valid: false, reason: `Agent does not steward zone ${zoneId}` };
    }
  }

  // Check total commons resources
  if (amount > state.commons.resourcePool * 0.5) {
    return { valid: false, reason: 'Cannot consume more than 50% of commons in one round' };
  }

  return { valid: true };
}

function validateContribute(
  action: AgentAction,
  agent: AgentState,
): ValidationResult {
  const amount = action.amount ?? 0;
  if (amount <= 0) {
    return { valid: false, reason: 'Contribute amount must be positive' };
  }
  if (amount > agent.resources) {
    return { valid: false, reason: 'Cannot contribute more than personal resources' };
  }
  return { valid: true };
}

function validateProposal(
  action: AgentAction,
  agent: AgentState,
  state: SimulationState,
): ValidationResult {
  const gov = state.governance;

  if (!agent.delegationConfig.authorityBounds.canPropose) {
    return { valid: false, reason: 'Delegation config does not allow proposals' };
  }

  if (!gov.collectiveChoice.enabled) {
    return { valid: false, reason: 'Collective choice is not enabled' };
  }

  if (gov.collectiveChoice.whoCanPropose === 'reputation_gate') {
    const threshold = gov.collectiveChoice.proposalReputationThreshold ?? 50;
    if (agent.reputation < threshold) {
      return { valid: false, reason: `Reputation ${agent.reputation} below proposal threshold ${threshold}` };
    }
  }

  if (gov.collectiveChoice.whoCanPropose === 'unsanctioned') {
    if (agent.sanctionLevel > 0) {
      return { valid: false, reason: 'Sanctioned agents cannot propose' };
    }
  }

  if (!action.proposal) {
    return { valid: false, reason: 'Proposal action requires a proposal object' };
  }

  return { valid: true };
}

function validateVote(
  action: AgentAction,
  agent: AgentState,
  state: SimulationState,
): ValidationResult {
  if (!state.governance.collectiveChoice.enabled) {
    return { valid: false, reason: 'Collective choice is not enabled' };
  }

  // Check staking requirement
  if (state.governance.validationStaking.enabled) {
    if (agent.stake < state.governance.validationStaking.minStake) {
      return {
        valid: false,
        reason: `Stake ${agent.stake} below minimum ${state.governance.validationStaking.minStake}`,
      };
    }
  }

  if (action.vote !== 'yes' && action.vote !== 'no') {
    return { valid: false, reason: 'Vote must be yes or no' };
  }

  return { valid: true };
}

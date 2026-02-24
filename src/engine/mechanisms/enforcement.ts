import type {
  AgentState,
  GovernanceConfig,
  GovernanceEvent,
} from '../../types';
import { narrowCapabilities } from '../identity/agent-did';
import { isUCANEnabled } from '../identity/ucan-validator';

interface EnforcementResult {
  agents: AgentState[];
  events: Partial<GovernanceEvent>[];
}

/**
 * Enforce governance rules after actions are applied.
 * Checks contribution requirements and applies graduated sanctions.
 */
export function enforceGovernance(
  round: number,
  agents: AgentState[],
  governance: GovernanceConfig,
  _existingEvents: GovernanceEvent[],
): EnforcementResult {
  let updatedAgents = [...agents.map((a) => ({ ...a }))];
  const events: Partial<GovernanceEvent>[] = [];

  // ── Contribution Requirement Enforcement ──
  if (governance.contributionRequirements.enabled) {
    const interval = governance.contributionRequirements.enforcementInterval;
    if (round > 0 && round % interval === 0) {
      events.push({
        type: 'enforcement_check',
        details: { round, type: 'contribution_compliance' },
      });

      const window = governance.contributionRequirements.measurementWindow;
      const minPct = governance.contributionRequirements.minContributionPercent / 100;

      for (let i = 0; i < updatedAgents.length; i++) {
        const agent = updatedAgents[i];
        if (agent.excluded || agent.suspended) continue;

        // Calculate rolling average contribution rate
        const recentContributions = agent.contributionHistory.slice(-window);
        const recentConsumptions = agent.consumptionHistory.slice(-window);
        const totalConsumed = recentConsumptions.reduce((s, v) => s + v, 0);
        const totalContributed = recentContributions.reduce((s, v) => s + v, 0);

        if (totalConsumed === 0) continue; // Didn't consume, no requirement

        const rate = totalContributed / totalConsumed;

        if (rate < minPct) {
          // Violation detected
          const consequence = governance.contributionRequirements.consequence;

          if (consequence === 'graduated_sanctions' && governance.graduatedSanctions.enabled) {
            const result = escalateSanction(agent, round, governance, `Contribution rate ${(rate * 100).toFixed(1)}% below minimum ${governance.contributionRequirements.minContributionPercent}%`);
            updatedAgents[i] = result.agent;
            events.push(...result.events);
          } else if (consequence === 'flat_penalty') {
            const penalty = governance.contributionRequirements.flatPenaltyAmount ?? 20;
            updatedAgents[i] = {
              ...agent,
              resources: Math.max(0, agent.resources - penalty),
              sanctions: [
                ...agent.sanctions,
                {
                  round,
                  type: 'penalty',
                  reason: `Flat penalty: contribution rate ${(rate * 100).toFixed(1)}%`,
                  amount: penalty,
                },
              ],
            };
            events.push({
              type: 'sanction_applied',
              details: { agentId: agent.id, type: 'flat_penalty', amount: penalty, rate: rate * 100 },
            });
          } else if (consequence === 'immediate_exclusion') {
            updatedAgents[i] = {
              ...agent,
              excluded: true,
              sanctions: [
                ...agent.sanctions,
                {
                  round,
                  type: 'exclusion',
                  reason: `Immediate exclusion: contribution rate ${(rate * 100).toFixed(1)}%`,
                },
              ],
            };
            events.push({
              type: 'agent_excluded',
              details: { agentId: agent.id, reason: 'contribution_violation' },
            });
          }
        }
      }
    }
  }

  // ── Sanction Decay ──
  if (governance.graduatedSanctions.enabled) {
    const decayRounds = governance.graduatedSanctions.decayRounds;
    for (let i = 0; i < updatedAgents.length; i++) {
      const agent = updatedAgents[i];
      if (agent.excluded || agent.sanctionLevel === 0) continue;

      // Check if agent has been clean for enough rounds
      const lastSanction = agent.sanctions[agent.sanctions.length - 1];
      if (lastSanction && round - lastSanction.round >= decayRounds) {
        updatedAgents[i] = {
          ...agent,
          sanctionLevel: Math.max(0, agent.sanctionLevel - 1),
        };
      }
    }
  }

  // ── Suspension Check ──
  for (let i = 0; i < updatedAgents.length; i++) {
    const agent = updatedAgents[i];
    if (agent.suspended && agent.suspendedUntilRound && round >= agent.suspendedUntilRound) {
      updatedAgents[i] = {
        ...agent,
        suspended: false,
        suspendedUntilRound: undefined,
      };
    }
  }

  return { agents: updatedAgents, events };
}

/**
 * Escalate sanctions using the graduated sanctions ladder.
 */
function escalateSanction(
  agent: AgentState,
  round: number,
  governance: GovernanceConfig,
  reason: string,
): { agent: AgentState; events: Partial<GovernanceEvent>[] } {
  const levels = governance.graduatedSanctions.levels;
  const currentLevel = agent.sanctionLevel;
  const events: Partial<GovernanceEvent>[] = [];

  // Find the level for current violation count
  const level = levels.find((l) => l.threshold === currentLevel + 1)
    ?? levels[levels.length - 1]; // Use highest if beyond defined levels

  if (!level) {
    return { agent, events };
  }

  let updatedAgent = {
    ...agent,
    sanctionLevel: currentLevel + 1,
  };

  switch (level.action) {
    case 'warning':
      updatedAgent.sanctions = [
        ...updatedAgent.sanctions,
        { round, type: 'warning', reason, reputationCost: level.reputationCost },
      ];
      updatedAgent.reputation = Math.max(0, updatedAgent.reputation - (level.reputationCost ?? 0));
      events.push({
        type: 'sanction_applied',
        details: { agentId: agent.id, level: 'warning', reason },
      });
      break;

    case 'penalty':
      const penalty = level.penaltyAmount ?? 20;
      updatedAgent.resources = Math.max(0, updatedAgent.resources - penalty);
      updatedAgent.reputation = Math.max(0, updatedAgent.reputation - (level.reputationCost ?? 10));
      updatedAgent.sanctions = [
        ...updatedAgent.sanctions,
        { round, type: 'penalty', reason, amount: penalty, reputationCost: level.reputationCost },
      ];
      events.push({
        type: 'sanction_applied',
        details: { agentId: agent.id, level: 'penalty', amount: penalty, reason },
      });

      // Stake slashing
      if (governance.validationStaking.enabled && governance.validationStaking.slashOnSanction) {
        const slashPct = (governance.validationStaking.slashPercent ?? 10) / 100;
        const slashed = Math.floor(updatedAgent.stake * slashPct);
        updatedAgent.stake = Math.max(0, updatedAgent.stake - slashed);
        events.push({
          type: 'stake_slashed',
          details: { agentId: agent.id, amount: slashed },
        });
      }
      break;

    case 'suspension':
      const duration = level.suspensionDuration ?? 3;
      updatedAgent.suspended = true;
      updatedAgent.suspendedUntilRound = round + duration;
      updatedAgent.reputation = Math.max(0, updatedAgent.reputation - (level.reputationCost ?? 25));
      updatedAgent.sanctions = [
        ...updatedAgent.sanctions,
        { round, type: 'suspension', reason, reputationCost: level.reputationCost },
      ];
      events.push({
        type: 'agent_suspended',
        details: { agentId: agent.id, duration, reason },
      });
      break;

    case 'exclusion':
      updatedAgent.excluded = true;
      updatedAgent.reputation = 0;
      updatedAgent.sanctions = [
        ...updatedAgent.sanctions,
        { round, type: 'exclusion', reason },
      ];
      events.push({
        type: 'agent_excluded',
        details: { agentId: agent.id, reason },
      });
      break;
  }

  // Narrow UCAN capabilities based on sanction severity
  if (isUCANEnabled() && updatedAgent.identity) {
    updatedAgent = {
      ...updatedAgent,
      identity: narrowCapabilities(updatedAgent.identity, level.action),
    };
  }

  return { agent: updatedAgent, events };
}

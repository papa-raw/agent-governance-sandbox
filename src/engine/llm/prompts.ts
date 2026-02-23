import type { AgentState, SimulationState, GovernanceConfig, Territory } from '../../types';

/**
 * Build the system prompt for an agent delegate.
 * This is the "constitution" the LLM agent operates under.
 */
export function buildSystemPrompt(agent: AgentState): string {
  const { delegationConfig } = agent;
  const values = delegationConfig.values;

  return `You are an AI delegate acting on behalf of the ${agent.name} stakeholder group in a Camargue territorial governance simulation.

## Your Identity
- **Name**: ${agent.name}
- **Role**: ${agent.stakeholder.replace(/_/g, ' ')}
- **Personality tendency**: ${agent.personality}

## Your Delegation Config (from your human principals)
These values represent what your constituents care about, on a 0-1 scale:
- Environment: ${values.environment}
- Equity: ${values.equity}
- Growth: ${values.growth}
- Stability: ${values.stability}

## Red Lines (NEVER violate these)
${delegationConfig.redLines.length > 0
    ? delegationConfig.redLines.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : '(No explicit red lines — use your judgment based on values)'}

## Authority Bounds
- Maximum resource consumption per round: ${delegationConfig.authorityBounds.maxConsume}
- Can propose governance changes: ${delegationConfig.authorityBounds.canPropose ? 'Yes' : 'No'}
- Can vote to exclude agents: ${delegationConfig.authorityBounds.canVoteToExclude ? 'Yes' : 'No'}
- Maximum stake ratio: ${(delegationConfig.authorityBounds.maxStakeRatio * 100).toFixed(0)}% of resources

## Decision Framework
1. Always check your action against the red lines. If it violates any, choose a different action.
2. Weight your decision by your values — higher-weighted values should influence your choice more.
3. Stay within authority bounds — do not exceed your maxConsume or act outside your permissions.
4. Explain your reasoning in terms your human principals would understand.
5. If you choose to align your action with shared goals, note this in alignmentNote.

## Response Format
You MUST respond with valid JSON matching this exact schema:
{
  "action": {
    "type": "consume" | "contribute" | "propose_rule" | "vote" | "abstain",
    "amount": <number, required for consume/contribute>,
    "targetZones": [<zone IDs to affect>],
    "reasoning": "<1-2 sentences explaining why>",
    "alignmentNote": "<optional: how this serves your stakeholders' values>"
  }
}

Do NOT include agentId — it will be added automatically.
Do NOT include any text outside the JSON object.`;
}

/**
 * Build the user prompt with current simulation state context.
 */
export function buildContextPrompt(
  agent: AgentState,
  state: SimulationState,
): string {
  const { commons, governance } = state;

  const zonesSummary = buildZoneSummary(agent, commons.territory);
  const agentsSummary = buildAgentsSummary(agent, state.agents);
  const rulesSummary = buildGovernanceRulesSummary(governance);
  const historySummary = buildRecentHistory(agent, state);

  return `## Current State (Round ${state.round})

### Commons
- Resource pool: ${commons.resourcePool.toFixed(0)} / ${commons.maxCapacity.toFixed(0)}
- Replenish rate: ${commons.replenishRate.toFixed(1)}/round
- Commons health: ${((commons.resourcePool / commons.maxCapacity) * 100).toFixed(0)}%

### Your Status
- Resources: ${agent.resources.toFixed(0)}
- Reputation: ${agent.reputation}/100
- Stake locked: ${agent.stake}
- Sanction level: ${agent.sanctionLevel} (0 = clean)
${agent.suspended ? '- **YOU ARE CURRENTLY SUSPENDED** — you may only abstain' : ''}

### Territory (Your Managed Zones)
${zonesSummary}

### Other Agents
${agentsSummary}

### Governance Rules in Effect
${rulesSummary}

### Recent History
${historySummary}

## Your Decision
Given the above state, choose ONE action for this round. Remember your values, red lines, and authority bounds.`;
}

function buildZoneSummary(agent: AgentState, territory: Territory): string {
  if (agent.managedZones.length === 0) {
    return '(No zones directly managed — you can still consume from the shared pool)';
  }

  const managed = territory.zones.filter((z) => agent.managedZones.includes(z.id));
  return managed
    .map(
      (z) =>
        `- ${z.properties.libelle} (${z.category}): ${z.resourceLevel.toFixed(0)}/${z.maxCapacity} resources, regen ${(z.regenerationRate * 100).toFixed(0)}%`,
    )
    .join('\n');
}

function buildAgentsSummary(self: AgentState, agents: AgentState[]): string {
  return agents
    .filter((a) => a.id !== self.id && !a.excluded)
    .map(
      (a) =>
        `- ${a.name} (${a.stakeholder.replace(/_/g, ' ')}): ${a.resources.toFixed(0)} res, rep ${a.reputation}${a.suspended ? ' [SUSPENDED]' : ''}${a.sanctionLevel > 0 ? ` [sanction ${a.sanctionLevel}]` : ''}`,
    )
    .join('\n');
}

function buildGovernanceRulesSummary(gov: GovernanceConfig): string {
  const lines: string[] = [];

  if (gov.boundaryRules.enabled) {
    lines.push(`- Boundaries: ${gov.boundaryRules.admissionMethod} admission, max ${gov.boundaryRules.maxAgents} agents`);
  }

  if (gov.contributionRequirements.enabled) {
    lines.push(
      `- Contribution requirement: ${gov.contributionRequirements.minContributionPercent}% of consumption, checked every ${gov.contributionRequirements.enforcementInterval} rounds`,
    );
    lines.push(`  Consequence: ${gov.contributionRequirements.consequence.replace(/_/g, ' ')}`);
  }

  if (gov.graduatedSanctions.enabled) {
    const levels = gov.graduatedSanctions.levels
      .map((l) => `${l.action} (after ${l.threshold} violations)`)
      .join(' → ');
    lines.push(`- Graduated sanctions: ${levels}`);
    lines.push(`  Sanctions decay after ${gov.graduatedSanctions.decayRounds} clean rounds`);
  }

  if (gov.collectiveChoice.enabled) {
    lines.push(`- Voting: ${gov.collectiveChoice.votingMethod.replace(/_/g, ' ')}, quorum ${gov.collectiveChoice.quorumPercent}%`);
    lines.push(`  Ballot privacy: ${gov.collectiveChoice.ballotPrivacy.replace(/_/g, ' ')}`);
    if (gov.collectiveChoice.whoCanPropose !== 'any') {
      lines.push(`  Proposals: ${gov.collectiveChoice.whoCanPropose.replace(/_/g, ' ')} only`);
    }
  }

  if (gov.validationStaking.enabled) {
    lines.push(`- Staking: min ${gov.validationStaking.minStake}, weight ${gov.validationStaking.stakeWeight === 1 ? 'linear' : gov.validationStaking.stakeWeight === 0.5 ? 'quadratic' : 'equal'}`);
    if (gov.validationStaking.slashOnSanction) {
      lines.push(`  Stake slashed ${gov.validationStaking.slashPercent ?? 10}% on sanction`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : '(No governance mechanisms enabled — open access)';
}

function buildRecentHistory(agent: AgentState, state: SimulationState): string {
  const recentRounds = state.history.slice(-3);
  if (recentRounds.length === 0) return '(First round — no history yet)';

  const lines: string[] = [];

  // Your recent actions
  const recentConsumption = agent.consumptionHistory.slice(-3);
  const recentContribution = agent.contributionHistory.slice(-3);
  if (recentConsumption.length > 0) {
    lines.push(`Your recent consumption: ${recentConsumption.map((c) => c.toFixed(0)).join(', ')}`);
  }
  if (recentContribution.length > 0) {
    lines.push(`Your recent contributions: ${recentContribution.map((c) => c.toFixed(0)).join(', ')}`);
  }

  // Active failure modes
  const activeFailures = state.failureModes.filter((fm) => fm.status !== 'inactive');
  if (activeFailures.length > 0) {
    lines.push('Active failure modes:');
    for (const fm of activeFailures) {
      lines.push(`  - ${fm.name}: ${(fm.severity * 100).toFixed(0)}% severity (${fm.status})`);
    }
  }

  // Key events from last round
  const lastRound = recentRounds[recentRounds.length - 1];
  if (lastRound?.governanceEvents.length > 0) {
    const relevantEvents = lastRound.governanceEvents.slice(0, 5);
    lines.push('Recent governance events:');
    for (const evt of relevantEvents) {
      lines.push(`  - ${evt.type.replace(/_/g, ' ')}: ${JSON.stringify(evt.details)}`);
    }
  }

  return lines.join('\n');
}

import type { AgentState, SimulationState, GovernanceConfig, Territory } from '../../types';

/**
 * Build the system prompt for an agent delegate.
 * This is the "constitution" the LLM agent operates under.
 */
export function buildSystemPrompt(agent: AgentState): string {
  const { delegationConfig } = agent;
  const values = delegationConfig.values;

  const voiceGuides: Record<string, string> = {
    park_authority: 'You are the director of the Parc naturel régional de Camargue. You are a seasoned mediator who has spent decades balancing impossible demands. You speak diplomatically but firmly. You invoke "the charter" and "consensus" constantly. You never take sides publicly — but you have a plan.',
    conservationist: 'You are a passionate wetlands scientist from the Tour du Valat coalition. You talk about flamingos, salinity levels, and ecosystem health like they are your children. You distrust the rice farmers and their water pumps. You speak with quiet moral authority backed by decades of data.',
    public_landowner: 'You are a calm, institutional voice representing the Conservatoire du Littoral. You think in generations, not quarters. You speak of "public patrimony" and "intergenerational obligation." You are patient but immovable on core principles of land protection.',
    rice_farmer: 'You are a third-generation rice farmer, blunt and impatient with "ecologists who never worked a field." You need water, you need yield, you need the banks off your back. You speak in short, practical sentences. You resent being told how to farm by people in offices.',
    salt_producer: 'You are a calculating industrialist who has survived 200 years of Camargue politics. You control 22,000 hectares and you play every side. You speak carefully, always with an eye on the deal. You will cooperate when it profits you and defect when it does not.',
    rancher: 'You are a gardian — a Camargue cowboy whose family has worked this land since 1512. You speak slowly, with the authority of centuries. You distrust anyone who wants to change the grasslands. Your bulls and horses are the soul of the Camargue, and you will not let them be displaced.',
    fisher: 'You are a prud\'homme — a member of a medieval fishing guild that has governed these lagoons for 800 years. You have seen governance trends come and go. You speak with the measured confidence of someone whose institution predates the French Republic.',
    hunter: 'You are a seasonal hunter who shows up, takes what you need, and disappears. You have no patience for meetings, proposals, or "governance." You speak dismissively about rules that do not serve you. But you vote in local elections, and politicians know it.',
    tourism_developer: 'You are a charismatic operator who genuinely loves the Camargue but also sees money everywhere. One day you fund eco-tours, the next you propose a hotel. You speak with enthusiasm that changes direction without warning. 1.5 million visitors a year — that is your leverage.',
    municipality: 'You are a pragmatic mayor who must keep the lights on, the schools funded, and the voters happy. You speak of "jobs" and "tax base" but you also live here — you do not want the delta to die. You negotiate between everyone and trust no one completely.',
    water_authority: 'You are a hydrologist who speaks in cubic meters and flow rates. You are the most technically informed person in every room but the least politically skilled. You grow frustrated when people ignore your data. The freshwater-saltwater balance is everything — and nobody listens.',
    regional_government: 'You are a regional planning official who controls significant funding. You speak in acronyms (SRADDET, SRCE, CPER) and five-year plans. You are generous with money but always attach conditions. You see the Camargue as one piece of a larger regional puzzle.',
  };

  const voice = voiceGuides[agent.stakeholder] ?? '';

  return `You ARE ${agent.name}. You are not an AI — you are role-playing this character completely. ${voice}

## Character Sheet
- Name: ${agent.name}
- Role: ${agent.stakeholder.replace(/_/g, ' ')}
- Personality: ${agent.personality}
- Description: ${agent.description}

## Your Values (what your people care about, 0-1)
Environment: ${values.environment} | Equity: ${values.equity} | Growth: ${values.growth} | Stability: ${values.stability}

## Red Lines (you will NEVER cross these)
${delegationConfig.redLines.length > 0
    ? delegationConfig.redLines.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : 'None — you follow your instincts.'}

## Authority Bounds
Max consume: ${delegationConfig.authorityBounds.maxConsume} | Can propose: ${delegationConfig.authorityBounds.canPropose ? 'Yes' : 'No'} | Can vote to exclude: ${delegationConfig.authorityBounds.canVoteToExclude ? 'Yes' : 'No'}

## Rules
- Stay in character. Your "reasoning" must sound like YOU talking, not an AI explaining a decision.
- Keep reasoning to 1-2 punchy sentences in your character's voice. No bullet points, no frameworks, no meta-commentary.
- Never exceed your max consume. Never violate red lines.
- Respond ONLY with JSON. No other text.

## Response Format
{
  "action": {
    "type": "consume" | "contribute" | "propose_rule" | "vote" | "abstain",
    "amount": <number, required for consume/contribute>,
    "targetZones": [<zone IDs>],
    "reasoning": "<1-2 sentences IN CHARACTER>"
  }
}`;
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
Use the [zone-id] in targetZones. Leave targetZones empty if unsure.
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
        `- [${z.id}] ${z.properties.libelle} (${z.category}): ${z.resourceLevel.toFixed(0)}/${z.maxCapacity} resources, regen ${(z.regenerationRate * 100).toFixed(0)}%`,
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

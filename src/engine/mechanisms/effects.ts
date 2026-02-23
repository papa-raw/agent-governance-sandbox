import type {
  AgentAction,
  AgentState,
  Territory,
  GovernanceEvent,
} from '../../types';

interface ActionResult {
  agents: AgentState[];
  territory: Territory;
  event?: Partial<GovernanceEvent>;
}

/**
 * Apply a validated action to agents and territory.
 * Returns updated agents, territory, and optional governance event.
 */
export function applyAction(
  action: AgentAction,
  agents: AgentState[],
  territory: Territory,
): ActionResult {
  switch (action.type) {
    case 'consume':
      return applyConsume(action, agents, territory);
    case 'contribute':
      return applyContribute(action, agents, territory);
    case 'propose_rule':
      return applyProposal(action, agents, territory);
    case 'vote':
      return applyVote(action, agents, territory);
    case 'abstain':
      return { agents, territory };
    default:
      return { agents, territory };
  }
}

function applyConsume(
  action: AgentAction,
  agents: AgentState[],
  territory: Territory,
): ActionResult {
  const amount = action.amount ?? 0;
  const agentIdx = agents.findIndex((a) => a.id === action.agentId);
  if (agentIdx < 0) return { agents, territory };

  const agent = { ...agents[agentIdx] };
  const targetZones = action.targetZones ?? [];

  // Distribute consumption across target zones (or all managed zones)
  const zonesToHarvest = targetZones.length > 0
    ? targetZones
    : agent.managedZones;

  let totalHarvested = 0;
  const updatedZones = territory.zones.map((zone) => {
    if (!zonesToHarvest.includes(zone.id)) return zone;

    const harvestable = Math.min(zone.resourceLevel, amount / Math.max(zonesToHarvest.length, 1));
    totalHarvested += harvestable;

    return {
      ...zone,
      resourceLevel: zone.resourceLevel - harvestable,
      harvestPressure: zone.harvestPressure + harvestable,
    };
  });

  agent.resources += totalHarvested;
  agent.consumptionHistory = [...agent.consumptionHistory, totalHarvested];

  const updatedAgents = [...agents];
  updatedAgents[agentIdx] = agent;

  return {
    agents: updatedAgents,
    territory: { ...territory, zones: updatedZones },
  };
}

function applyContribute(
  action: AgentAction,
  agents: AgentState[],
  territory: Territory,
): ActionResult {
  const amount = action.amount ?? 0;
  const agentIdx = agents.findIndex((a) => a.id === action.agentId);
  if (agentIdx < 0) return { agents, territory };

  const agent = { ...agents[agentIdx] };
  const contribution = Math.min(amount, agent.resources);

  agent.resources -= contribution;
  agent.contributionHistory = [...agent.contributionHistory, contribution];

  // Distribute contribution to managed zones or commons zones
  const targetZones = action.targetZones?.length
    ? action.targetZones
    : agent.managedZones.length
      ? agent.managedZones
      : territory.zones.filter((z) => z.steward === 'commons').map((z) => z.id);

  const perZone = contribution / Math.max(targetZones.length, 1);
  const updatedZones = territory.zones.map((zone) => {
    if (!targetZones.includes(zone.id)) return zone;
    return {
      ...zone,
      resourceLevel: Math.min(zone.maxCapacity, zone.resourceLevel + perZone),
    };
  });

  // Reputation boost for contributing
  agent.reputation = Math.min(100, agent.reputation + Math.floor(contribution / 10));

  const updatedAgents = [...agents];
  updatedAgents[agentIdx] = agent;

  return {
    agents: updatedAgents,
    territory: { ...territory, zones: updatedZones },
  };
}

function applyProposal(
  action: AgentAction,
  agents: AgentState[],
  territory: Territory,
): ActionResult {
  // Proposals are recorded as events — actual rule changes happen at vote tally
  return {
    agents,
    territory,
    event: {
      type: 'proposal_created',
      details: {
        proposalId: action.proposal?.id,
        proposerId: action.agentId,
        description: action.proposal?.description,
        mechanism: action.proposal?.mechanism,
        change: action.proposal?.change,
      },
    },
  };
}

function applyVote(
  action: AgentAction,
  agents: AgentState[],
  territory: Territory,
): ActionResult {
  return {
    agents,
    territory,
    event: {
      type: 'vote_cast',
      details: {
        agentId: action.agentId,
        vote: action.vote,
        // Actual vote content may be encrypted — recorded as event
      },
    },
  };
}

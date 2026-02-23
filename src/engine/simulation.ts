import { v4 as uuid } from 'uuid';
import type {
  SimulationState,
  CommonsState,
  AgentState,
  AgentAction,
  GovernanceConfig,
  GovernanceEvent,
  RoundResult,
  Territory,
  FailureMode,
} from '../types';
import { validateAction } from './mechanisms/validation';
import { applyAction } from './mechanisms/effects';
import { enforceGovernance } from './mechanisms/enforcement';
import { detectFailureModes } from './mechanisms/failure-modes';
import { computeReplicatorPrediction } from './mechanisms/replicator';
import { regenerateTerritory } from './mechanisms/regeneration';

// ── Simulation Engine ──

export function createSimulation(
  governance: GovernanceConfig,
  agents: AgentState[],
  territory: Territory,
): SimulationState {
  const commons: CommonsState = {
    resourcePool: territory.totalResources,
    maxCapacity: territory.totalResources,
    replenishRate: computeBaseReplenishRate(territory),
    territory,
  };

  return {
    id: uuid(),
    round: 0,
    commons,
    agents,
    governance,
    failureModes: initializeFailureModes(),
    history: [],
    status: 'idle',
  };
}

/**
 * Execute a single round of the simulation.
 *
 * The round loop:
 * 1. Agents observe the commons state
 * 2. Agents decide (actions provided by caller — LLM or deterministic)
 * 3. Governance engine validates actions
 * 4. Apply valid actions to territory
 * 5. Enforce governance rules (contribution checks, sanctions)
 * 6. Regenerate territory (density-dependent)
 * 7. Detect failure modes
 * 8. Record round result
 */
export function executeRound(
  state: SimulationState,
  agentActions: AgentAction[],
): { state: SimulationState; result: RoundResult } {
  const round = state.round + 1;
  const events: GovernanceEvent[] = [];
  const validActions: AgentAction[] = [];

  // Step 1-2: Actions come from caller (LLM agent runtime or deterministic)

  // Step 3: Validate each action against governance rules
  for (const action of agentActions) {
    const agent = state.agents.find((a) => a.id === action.agentId);
    if (!agent || agent.excluded || agent.suspended) continue;

    const validation = validateAction(action, agent, state);
    if (validation.valid) {
      validActions.push(action);
    } else {
      events.push({
        type: 'sanction_applied',
        round,
        details: {
          agentId: action.agentId,
          reason: validation.reason,
          actionType: action.type,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Step 4: Apply valid actions to territory and agent state
  let updatedAgents = [...state.agents.map((a) => ({ ...a }))];
  let updatedTerritory = deepCloneTerritory(state.commons.territory);

  for (const action of validActions) {
    const result = applyAction(action, updatedAgents, updatedTerritory);
    updatedAgents = result.agents;
    updatedTerritory = result.territory;
    if (result.event?.type) {
      events.push({
        type: result.event.type,
        round,
        timestamp: new Date().toISOString(),
        details: result.event.details ?? {},
      });
    }
  }

  // Step 5: Enforce governance rules (contribution checks, sanctions)
  const enforcement = enforceGovernance(round, updatedAgents, state.governance, events);
  updatedAgents = enforcement.agents;
  for (const e of enforcement.events) {
    if (e.type) {
      events.push({
        type: e.type,
        round,
        timestamp: new Date().toISOString(),
        details: e.details ?? {},
      });
    }
  }

  // Step 6: Regenerate territory (density-dependent)
  updatedTerritory = regenerateTerritory(updatedTerritory);

  // Recompute territory aggregates
  const totalResources = updatedTerritory.zones.reduce((sum, z) => sum + z.resourceLevel, 0);
  updatedTerritory.totalResources = totalResources;
  updatedTerritory.biodiversityIndex = computeBiodiversity(updatedTerritory);
  updatedTerritory.giniCoefficient = computeGini(updatedAgents);
  updatedTerritory.sustainabilityScore = computeSustainability(updatedTerritory);

  // Step 7: Detect failure modes
  const updatedCommons: CommonsState = {
    ...state.commons,
    resourcePool: totalResources,
    territory: updatedTerritory,
  };

  const failureModes = detectFailureModes(
    { ...state, round, agents: updatedAgents, commons: updatedCommons },
    state.failureModes,
  );

  // Compute cooperation metrics
  const replicatorPrediction = computeReplicatorPrediction(updatedAgents, state.governance, updatedTerritory);
  const actualCooperationRate = computeActualCooperationRate(validActions, updatedAgents);

  // Check for commons collapse
  const maxCapacity = updatedTerritory.zones.reduce((sum, z) => sum + z.maxCapacity, 0);
  const collapsed = totalResources / maxCapacity < 0.05;

  // Step 8: Record round result
  const result: RoundResult = {
    round,
    actions: validActions,
    governanceEvents: events,
    commonsLevel: totalResources,
    territorySnapshot: {
      totalResources,
      biodiversityIndex: updatedTerritory.biodiversityIndex,
      giniCoefficient: updatedTerritory.giniCoefficient,
      sustainabilityScore: updatedTerritory.sustainabilityScore,
      waterBalance: updatedTerritory.waterBalance,
    },
    failureModes: [...failureModes],
    replicatorPrediction,
    actualCooperationRate,
  };

  const newState: SimulationState = {
    ...state,
    round,
    commons: updatedCommons,
    agents: updatedAgents,
    governance: state.governance,
    failureModes,
    history: [...state.history, result],
    status: collapsed ? 'collapsed' : 'running',
  };

  return { state: newState, result };
}

// ── Helper Functions ──

function computeBaseReplenishRate(territory: Territory): number {
  // Average regeneration rate across all zones
  const totalRegen = territory.zones.reduce((sum, z) => sum + z.regenerationRate, 0);
  return totalRegen / Math.max(territory.zones.length, 1);
}

function computeBiodiversity(territory: Territory): number {
  // Shannon diversity index on land use categories
  const categoryCounts = new Map<string, number>();
  for (const zone of territory.zones) {
    const count = categoryCounts.get(zone.category) ?? 0;
    categoryCounts.set(zone.category, count + 1);
  }
  const total = territory.zones.length;
  if (total === 0) return 0;

  let shannon = 0;
  for (const count of categoryCounts.values()) {
    const p = count / total;
    if (p > 0) shannon -= p * Math.log(p);
  }
  // Normalize to 0-100 (max Shannon for 9 categories = ln(9) ≈ 2.197)
  return Math.min(100, (shannon / 2.197) * 100);
}

function computeGini(agents: AgentState[]): number {
  const active = agents.filter((a) => !a.excluded);
  if (active.length <= 1) return 0;

  const resources = active.map((a) => a.resources).sort((a, b) => a - b);
  const n = resources.length;
  const totalResources = resources.reduce((s, r) => s + r, 0);
  if (totalResources === 0) return 0;

  let sumOfDifferences = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumOfDifferences += Math.abs(resources[i] - resources[j]);
    }
  }
  return sumOfDifferences / (2 * n * totalResources);
}

function computeSustainability(territory: Territory): number {
  const totalRegen = territory.zones.reduce((sum, z) => sum + z.regenerationRate, 0);
  const totalPressure = territory.zones.reduce((sum, z) => sum + z.harvestPressure, 0);
  if (totalPressure === 0) return 100;
  // Score: 100 when regen >> pressure, 0 when pressure >> regen
  return Math.max(0, Math.min(100, (totalRegen / totalPressure) * 50));
}

function computeActualCooperationRate(actions: AgentAction[], agents: AgentState[]): number {
  const activeAgents = agents.filter((a) => !a.excluded && !a.suspended);
  if (activeAgents.length === 0) return 0;

  const cooperativeActions = actions.filter(
    (a) => a.type === 'contribute' || a.type === 'propose_rule' || a.type === 'vote',
  );
  return cooperativeActions.length / Math.max(actions.length, 1);
}

function deepCloneTerritory(territory: Territory): Territory {
  return {
    ...territory,
    zones: territory.zones.map((z) => ({
      ...z,
      properties: { ...z.properties },
      adjacentZones: [...z.adjacentZones],
    })),
  };
}

function initializeFailureModes(): FailureMode[] {
  return [
    {
      id: 'commons_depletion',
      name: 'Commons Depletion',
      description: 'Total resources fall below critical threshold',
      category: 'commons',
      status: 'inactive',
      severity: 0,
      triggerThreshold: 0.5,
      evidence: '',
      cascadesTo: ['governance_deadlock'],
    },
    {
      id: 'free_riding',
      name: 'Free Riding',
      description: 'Agent consumes far more than they contribute',
      category: 'commons',
      status: 'inactive',
      severity: 0,
      triggerThreshold: 0.5,
      evidence: '',
      cascadesTo: ['commons_depletion'],
    },
    {
      id: 'stake_concentration',
      name: 'Stake Concentration',
      description: 'One agent holds disproportionate governance power',
      category: 'governance',
      status: 'inactive',
      severity: 0,
      triggerThreshold: 0.5,
      evidence: '',
      cascadesTo: ['institutional_capture'],
    },
    {
      id: 'institutional_capture',
      name: 'Institutional Capture',
      description: 'One agent dominates proposal outcomes',
      category: 'governance',
      status: 'inactive',
      severity: 0,
      triggerThreshold: 0.5,
      evidence: '',
      cascadesTo: ['democratic_deficit'],
    },
    {
      id: 'democratic_deficit',
      name: 'Democratic Deficit',
      description: 'Low voter turnout undermines governance legitimacy',
      category: 'governance',
      status: 'inactive',
      severity: 0,
      triggerThreshold: 0.5,
      evidence: '',
      cascadesTo: ['governance_deadlock'],
    },
    {
      id: 'sanction_fatigue',
      name: 'Sanction Fatigue',
      description: 'Too many sanctions issued — enforcement is overwhelming governance',
      category: 'governance',
      status: 'inactive',
      severity: 0,
      triggerThreshold: 0.5,
      evidence: '',
      cascadesTo: ['exclusion_cascade'],
    },
    {
      id: 'governance_deadlock',
      name: 'Governance Deadlock',
      description: 'Consecutive proposals fail to reach quorum',
      category: 'governance',
      status: 'inactive',
      severity: 0,
      triggerThreshold: 0.5,
      evidence: '',
      cascadesTo: [],
    },
    {
      id: 'exclusion_cascade',
      name: 'Exclusion Cascade',
      description: 'Large fraction of agents excluded in a short period',
      category: 'governance',
      status: 'inactive',
      severity: 0,
      triggerThreshold: 0.5,
      evidence: '',
      cascadesTo: ['commons_depletion'],
    },
  ];
}

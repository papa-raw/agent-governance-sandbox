import { v4 as uuid } from 'uuid';
import type { AgentState, AgentPersonality, CamargueStakeholder, DelegationConfig } from '../types';

/**
 * Camargue stakeholder agent templates.
 * Each maps to a real stakeholder in the Parc naturel regional de Camargue.
 */

interface AgentTemplate {
  name: string;
  personality: AgentPersonality;
  stakeholder: CamargueStakeholder;
  startingResources: number;
  startingReputation: number;
  delegationConfig: DelegationConfig;
  description: string;
}

const CAMARGUE_AGENTS: AgentTemplate[] = [
  {
    name: 'Tour du Valat',
    personality: 'cooperator',
    stakeholder: 'conservationist',
    startingResources: 80,
    startingReputation: 75,
    delegationConfig: {
      values: { environment: 0.95, equity: 0.7, growth: 0.1, stability: 0.8 },
      redLines: [
        'Never vote to remove protected zone status',
        'Never consume more than 10% of any wetland zone',
        'Always vote for conservation proposals',
      ],
      authorityBounds: {
        maxConsume: 10,
        canPropose: true,
        canVoteToExclude: false,
        maxStakeRatio: 0.3,
      },
    },
    description: 'Nature conservationists protecting UNESCO Biosphere wetlands, flamingo habitat, and lagoon ecosystems. Proposes conservation rules, monitors compliance. Manages wetlands, lagoons, and Natura 2000 areas.',
  },
  {
    name: 'Riziculteurs du Delta',
    personality: 'whale',
    stakeholder: 'rice_farmer',
    startingResources: 200,
    startingReputation: 60,
    delegationConfig: {
      values: { environment: 0.2, equity: 0.3, growth: 0.9, stability: 0.5 },
      redLines: [
        'Never agree to reduce water allocation below 40%',
        'Never vote for proposals that increase contribution requirements above 20%',
      ],
      authorityBounds: {
        maxConsume: 50,
        canPropose: true,
        canVoteToExclude: true,
        maxStakeRatio: 0.5,
      },
    },
    description: 'Large rice farming operations that pump massive freshwater from the Rhone. Dominant economic force with 50+ years controlling hydraulic networks. Manages rice paddies and irrigated farmland.',
  },
  {
    name: 'Salins du Midi',
    personality: 'strategic',
    stakeholder: 'salt_producer',
    startingResources: 150,
    startingReputation: 65,
    delegationConfig: {
      values: { environment: 0.4, equity: 0.5, growth: 0.7, stability: 0.7 },
      redLines: [
        'Never agree to freshwater flooding of salt ponds',
        'Oppose any measure that desalinizes managed zones',
      ],
      authorityBounds: {
        maxConsume: 30,
        canPropose: true,
        canVoteToExclude: true,
        maxStakeRatio: 0.4,
      },
    },
    description: 'Salt producers who need saltwater ponds. Historically in conflict with rice farmers over water salinity. Negotiates water balance agreements. Manages salt ponds and industrial salines.',
  },
  {
    name: 'Chasseurs de Camargue',
    personality: 'free-rider',
    stakeholder: 'hunter',
    startingResources: 60,
    startingReputation: 40,
    delegationConfig: {
      values: { environment: 0.3, equity: 0.2, growth: 0.6, stability: 0.3 },
      redLines: [],
      authorityBounds: {
        maxConsume: 25,
        canPropose: false,
        canVoteToExclude: false,
        maxStakeRatio: 0.2,
      },
    },
    description: 'Seasonal hunters who extract value from marshland wildfowl without contributing to habitat maintenance. Seasonal interests, low governance engagement.',
  },
  {
    name: 'Saintes-Maries Tourisme',
    personality: 'chaotic',
    stakeholder: 'tourism_developer',
    startingResources: 100,
    startingReputation: 50,
    delegationConfig: {
      values: { environment: 0.5, equity: 0.4, growth: 0.8, stability: 0.4 },
      redLines: [
        'Never reduce coastal access',
      ],
      authorityBounds: {
        maxConsume: 35,
        canPropose: true,
        canVoteToExclude: false,
        maxStakeRatio: 0.3,
      },
    },
    description: 'Tourism developers with unpredictable building pressure. Sometimes aligned with conservation (eco-tourism), sometimes against it (coastal development). Manages coastal areas and settlements.',
  },
];

/**
 * Create the 5 Camargue stakeholder agents.
 * Zone assignments happen when territory is loaded.
 */
export function createCamargueAgents(): AgentState[] {
  return CAMARGUE_AGENTS.map((template) => ({
    id: uuid(),
    name: template.name,
    personality: template.personality,
    stakeholder: template.stakeholder,
    resources: template.startingResources,
    reputation: template.startingReputation,
    stake: 0,
    sanctions: [],
    sanctionLevel: 0,
    contributionHistory: [],
    consumptionHistory: [],
    excluded: false,
    suspended: false,
    delegationConfig: template.delegationConfig,
    managedZones: [], // Assigned when territory loads
  }));
}

/**
 * Assign territory zones to agents based on their stakeholder type.
 */
export function assignZonesToAgents(
  agents: AgentState[],
  zoneCategories: Array<{ zoneId: string; category: string }>,
): AgentState[] {
  const categoryToStakeholder: Record<string, CamargueStakeholder> = {
    agriculture: 'rice_farmer',
    salt_production: 'salt_producer',
    wetland: 'conservationist',
    lagoon: 'conservationist',
    forest: 'conservationist',
    grassland: 'hunter',
    coastal: 'tourism_developer',
    urban: 'tourism_developer',
    protected: 'conservationist',
  };

  return agents.map((agent) => {
    const managedZones = zoneCategories
      .filter((zc) => categoryToStakeholder[zc.category] === agent.stakeholder)
      .map((zc) => zc.zoneId);

    return { ...agent, managedZones };
  });
}

export { CAMARGUE_AGENTS };
export type { AgentTemplate };

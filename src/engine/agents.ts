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
    name: 'Parc naturel régional',
    personality: 'strategic',
    stakeholder: 'park_authority',
    startingResources: 120,
    startingReputation: 80,
    delegationConfig: {
      values: { environment: 0.75, equity: 0.8, growth: 0.3, stability: 0.85 },
      redLines: [
        'Never approve development in core Natura 2000 zones',
        'Always support graduated enforcement over immediate exclusion',
        'Never allow any single stakeholder to control >30% of water allocation',
      ],
      authorityBounds: {
        maxConsume: 15,
        canPropose: true,
        canVoteToExclude: true,
        maxStakeRatio: 0.3,
      },
    },
    description: 'PNRC (Parc naturel régional de Camargue) — the coordination body that mediates between all stakeholders. Established 1970. Facilitates consensus, proposes compromise rules, and monitors compliance across 100,000+ ha.',
  },
  {
    name: 'Conservateurs du Delta',
    personality: 'cooperator',
    stakeholder: 'conservationist',
    startingResources: 100,
    startingReputation: 85,
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
    description: 'Coalition of Tour du Valat (research station, est. 1954), SNPN (Réserve Nationale manager), WWF France (Mediterranean program), and LPO PACA (bird protection). Scientific authority on wetland health.',
  },
  {
    name: 'Conservatoire du Littoral',
    personality: 'cooperator',
    stakeholder: 'public_landowner',
    startingResources: 200,
    startingReputation: 80,
    delegationConfig: {
      values: { environment: 0.8, equity: 0.75, growth: 0.15, stability: 0.9 },
      redLines: [
        'Never sell or lease public land for private development',
        'Never allow industrial use of protected coastal zones',
        'Maintain OFB enforcement capacity on managed parcels',
      ],
      authorityBounds: {
        maxConsume: 10,
        canPropose: true,
        canVoteToExclude: true,
        maxStakeRatio: 0.25,
      },
    },
    description: 'Public landowner coalition — Conservatoire du Littoral (coastal agency) + OFB (Office français de la biodiversité). Controls ~25,000 ha of public conservation land. Patient, institutional, focused on intergenerational stewardship.',
  },
  {
    name: 'Riziculteurs du Delta',
    personality: 'whale',
    stakeholder: 'rice_farmer',
    startingResources: 250,
    startingReputation: 55,
    delegationConfig: {
      values: { environment: 0.2, equity: 0.3, growth: 0.9, stability: 0.5 },
      redLines: [
        'Never agree to reduce water allocation below 40%',
        'Never vote for proposals that increase contribution requirements above 20%',
        'Block any measure that restricts Rhône pumping rights',
      ],
      authorityBounds: {
        maxConsume: 50,
        canPropose: true,
        canVoteToExclude: true,
        maxStakeRatio: 0.5,
      },
    },
    description: 'SRFF (Syndicat des Riziculteurs) + CFR (Centre Français du Riz) + 160 rice farms managing 15,000 ha. Dominant economic force — pumps massive freshwater from the Rhône. Controls hydraulic networks built over 50+ years.',
  },
  {
    name: 'Salins Group',
    personality: 'strategic',
    stakeholder: 'salt_producer',
    startingResources: 300,
    startingReputation: 60,
    delegationConfig: {
      values: { environment: 0.4, equity: 0.3, growth: 0.8, stability: 0.7 },
      redLines: [
        'Never agree to freshwater flooding of salt ponds',
        'Oppose any measure that desalinizes managed zones',
        'Maintain exclusive control of Salin-de-Giraud operations',
      ],
      authorityBounds: {
        maxConsume: 40,
        canPropose: true,
        canVoteToExclude: true,
        maxStakeRatio: 0.4,
      },
    },
    description: 'Salins Group — industrial salt production across 22,000 ha. Largest private landowner in the Camargue. 200+ years of delta politics. Evaporation ponds are paradoxically critical flamingo habitat. Plays every side.',
  },
  {
    name: 'Gardians & Manades',
    personality: 'cooperator',
    stakeholder: 'rancher',
    startingResources: 80,
    startingReputation: 75,
    delegationConfig: {
      values: { environment: 0.6, equity: 0.65, growth: 0.4, stability: 0.7 },
      redLines: [
        'Never support converting grassland to rice paddies or salt ponds',
        'Protect the tradition of free-range Camargue horse and bull grazing',
      ],
      authorityBounds: {
        maxConsume: 20,
        canPropose: true,
        canVoteToExclude: false,
        maxStakeRatio: 0.3,
      },
    },
    description: 'Confrérie des Gardians (est. 1512) + ~150 manades (ranches). Traditional low-intensity livestock on Camargue bulls and white horses. Cultural guardians whose grazing practices maintain grassland biodiversity.',
  },
  {
    name: 'Prud\'homies de Pêche',
    personality: 'strategic',
    stakeholder: 'fisher',
    startingResources: 60,
    startingReputation: 60,
    delegationConfig: {
      values: { environment: 0.55, equity: 0.7, growth: 0.5, stability: 0.6 },
      redLines: [
        'Never support actions that degrade lagoon water quality below fishing viability',
        'Maintain medieval fishing rights in Etang de Vaccarès',
      ],
      authorityBounds: {
        maxConsume: 20,
        canPropose: true,
        canVoteToExclude: false,
        maxStakeRatio: 0.3,
      },
    },
    description: 'Medieval self-governing fishing guilds (Prud\'homies, est. 13th century) + modern aquaculture. Manage traditional fishing rights in Vaccarès and coastal lagoons. One of Europe\'s oldest common-pool resource institutions.',
  },
  {
    name: 'Chasseurs de Camargue',
    personality: 'free-rider',
    stakeholder: 'hunter',
    startingResources: 70,
    startingReputation: 40,
    delegationConfig: {
      values: { environment: 0.3, equity: 0.2, growth: 0.6, stability: 0.3 },
      redLines: [
        'Never support total hunting bans in wetland zones',
      ],
      authorityBounds: {
        maxConsume: 25,
        canPropose: false,
        canVoteToExclude: false,
        maxStakeRatio: 0.2,
      },
    },
    description: 'FDC 13 (Fédération Départementale des Chasseurs) + local ACCAs. 16,500 members with seasonal extraction interests. Low governance engagement but politically influential in rural communes.',
  },
  {
    name: 'Destination Camargue',
    personality: 'chaotic',
    stakeholder: 'tourism_developer',
    startingResources: 120,
    startingReputation: 50,
    delegationConfig: {
      values: { environment: 0.5, equity: 0.4, growth: 0.8, stability: 0.4 },
      redLines: [
        'Never reduce coastal beach access for tourists',
      ],
      authorityBounds: {
        maxConsume: 35,
        canPropose: true,
        canVoteToExclude: false,
        maxStakeRatio: 0.3,
      },
    },
    description: 'Tourism offices (Saintes-Maries-de-la-Mer, Arles) + private operators (hotels, tour companies, horse rides). Unpredictable: sometimes eco-tourism champion, sometimes coastal development pressure. 1.5M+ visitors/year.',
  },
  {
    name: 'Communes du Delta',
    personality: 'strategic',
    stakeholder: 'municipality',
    startingResources: 180,
    startingReputation: 65,
    delegationConfig: {
      values: { environment: 0.45, equity: 0.6, growth: 0.65, stability: 0.75 },
      redLines: [
        'Never support measures that reduce municipal tax base',
        'Maintain urban development rights within PLU zones',
      ],
      authorityBounds: {
        maxConsume: 25,
        canPropose: true,
        canVoteToExclude: true,
        maxStakeRatio: 0.35,
      },
    },
    description: 'Three delta municipalities — Arles (pop. 52,000), Saintes-Maries-de-la-Mer (pop. 2,500), Port-Saint-Louis-du-Rhône (pop. 8,500). Balance economic development, flood protection, and resident needs.',
  },
  {
    name: 'Autorité de l\'Eau',
    personality: 'cooperator',
    stakeholder: 'water_authority',
    startingResources: 200,
    startingReputation: 70,
    delegationConfig: {
      values: { environment: 0.7, equity: 0.8, growth: 0.25, stability: 0.85 },
      redLines: [
        'Never approve water allocation that violates EU Water Framework Directive',
        'Maintain minimum ecological flows in all channels',
        'Never allow unmonitored pumping from Rhône',
      ],
      authorityBounds: {
        maxConsume: 10,
        canPropose: true,
        canVoteToExclude: true,
        maxStakeRatio: 0.3,
      },
    },
    description: 'Agence de l\'Eau Rhône-Méditerranée-Corse + SYMADREM (Rhône dike management) + CEDE (water allocation committee). Controls the delta\'s lifeblood: freshwater-saltwater balance that determines all other land uses.',
  },
  {
    name: 'Région & Département',
    personality: 'strategic',
    stakeholder: 'regional_government',
    startingResources: 200,
    startingReputation: 65,
    delegationConfig: {
      values: { environment: 0.5, equity: 0.6, growth: 0.55, stability: 0.8 },
      redLines: [
        'Never support measures conflicting with SRADDET regional planning',
        'Maintain co-funding commitments for Natura 2000 management',
      ],
      authorityBounds: {
        maxConsume: 15,
        canPropose: true,
        canVoteToExclude: true,
        maxStakeRatio: 0.35,
      },
    },
    description: 'Région Provence-Alpes-Côte d\'Azur + Département Bouches-du-Rhône. Regional funders who co-finance conservation, infrastructure, and agricultural programs. Set strategic planning frameworks (SRADDET).',
  },
];

/**
 * Create the 12 Camargue archetype agents.
 * Accepts optional custom templates (from delegation console) or uses defaults.
 * Zone assignments happen when territory is loaded.
 */
export function createCamargueAgents(customTemplates?: AgentTemplate[]): AgentState[] {
  const templates = customTemplates ?? CAMARGUE_AGENTS;
  return templates.map((template) => ({
    id: uuid(),
    name: template.name,
    description: template.description,
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
 * For shared categories (wetland, lagoon, protected), zones are distributed
 * between conservationist and public_landowner by alternating assignment.
 * Governance-role agents (park_authority, municipality, water_authority,
 * regional_government) get no exclusive zones — they influence via rules.
 */
export function assignZonesToAgents(
  agents: AgentState[],
  zoneCategories: Array<{ zoneId: string; category: string }>,
): AgentState[] {
  // Primary stakeholder for each land use category
  const categoryToStakeholder: Record<string, CamargueStakeholder> = {
    agriculture: 'rice_farmer',
    salt_production: 'salt_producer',
    grassland: 'rancher',
    coastal: 'tourism_developer',
    urban: 'tourism_developer',
    forest: 'conservationist',
  };

  // Shared categories distributed between two stakeholders (alternating)
  const sharedCategories: Record<string, [CamargueStakeholder, CamargueStakeholder]> = {
    wetland: ['conservationist', 'public_landowner'],
    lagoon: ['conservationist', 'fisher'],
    protected: ['conservationist', 'public_landowner'],
  };

  // Build per-agent zone lists
  const agentZoneMap = new Map<string, string[]>();
  for (const agent of agents) {
    agentZoneMap.set(agent.id, []);
  }

  // Track alternation index for shared categories
  const sharedCounters: Record<string, number> = {};

  for (const zc of zoneCategories) {
    const primary = categoryToStakeholder[zc.category];
    const shared = sharedCategories[zc.category];

    if (primary) {
      // Assign to the first agent matching this stakeholder
      const agent = agents.find((a) => a.stakeholder === primary);
      if (agent) agentZoneMap.get(agent.id)!.push(zc.zoneId);
    } else if (shared) {
      // Alternate between the two stakeholder types
      const counter = sharedCounters[zc.category] ?? 0;
      const targetStakeholder = shared[counter % 2];
      sharedCounters[zc.category] = counter + 1;
      const agent = agents.find((a) => a.stakeholder === targetStakeholder);
      if (agent) agentZoneMap.get(agent.id)!.push(zc.zoneId);
    }
    // Governance-role agents (park_authority, municipality, etc.) get no exclusive zones
  }

  return agents.map((agent) => ({
    ...agent,
    managedZones: agentZoneMap.get(agent.id) ?? [],
  }));
}

export { CAMARGUE_AGENTS };
export type { AgentTemplate };

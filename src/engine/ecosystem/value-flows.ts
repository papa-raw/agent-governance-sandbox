/**
 * Value Flow Ledger — REA Accounting for Ecosystem Services
 *
 * Every simulation action produces EUR-denominated value transfer records.
 * Tracks extraction (commodity harvested), contribution (ecosystem recovery),
 * externality (cross-zone impacts), and regeneration (natural recovery).
 *
 * Externality rules encode Camargue-specific ecological linkages:
 * rice farming degrades downstream water quality, salt extraction harms
 * adjacent biodiversity, but wetland restoration improves neighbor flood regulation.
 */

import { v4 as uuid } from 'uuid';
import type {
  AgentAction,
  AgentState,
  TerritorialZone,
  Territory,
  ValueFlow,
  AgentAttribution,
  LandUseCategory,
} from '../../types';

// ── Externality Rules (PRD line 1270-1277) ──

interface ExternalityRule {
  triggerAction: 'consume' | 'contribute';
  triggerCategory: LandUseCategory;
  affectedCategory: LandUseCategory;
  affectedService: keyof typeof SERVICE_KEY_MAP;
  impactFactor: number;  // negative = damage, positive = benefit
  description: string;
}

const SERVICE_KEY_MAP = {
  waterPurification: 'waterPurification',
  fishNursery: 'fishNursery',
  biodiversityHabitat: 'biodiversityHabitat',
  floodRegulation: 'floodRegulation',
} as const;

export const EXTERNALITY_RULES: ExternalityRule[] = [
  {
    triggerAction: 'consume',
    triggerCategory: 'agriculture',
    affectedCategory: 'wetland',
    affectedService: 'waterPurification',
    impactFactor: -0.15,
    description: 'Rice harvest runoff degrades adjacent wetland water purification',
  },
  {
    triggerAction: 'consume',
    triggerCategory: 'agriculture',
    affectedCategory: 'lagoon',
    affectedService: 'fishNursery',
    impactFactor: -0.10,
    description: 'Rice harvest runoff harms downstream lagoon fish nursery',
  },
  {
    triggerAction: 'consume',
    triggerCategory: 'salt_production',
    affectedCategory: 'wetland',
    affectedService: 'biodiversityHabitat',
    impactFactor: -0.08,
    description: 'Salt extraction disrupts adjacent wetland biodiversity',
  },
  {
    triggerAction: 'consume',
    triggerCategory: 'coastal',
    affectedCategory: 'protected',
    affectedService: 'biodiversityHabitat',
    impactFactor: -0.12,
    description: 'Tourism development pressures adjacent protected biodiversity',
  },
  {
    triggerAction: 'contribute',
    triggerCategory: 'wetland',
    affectedCategory: 'agriculture',
    affectedService: 'floodRegulation',
    impactFactor: 0.20,
    description: 'Wetland restoration improves adjacent agriculture flood regulation',
  },
  {
    triggerAction: 'contribute',
    triggerCategory: 'protected',
    affectedCategory: 'lagoon',
    affectedService: 'fishNursery',
    impactFactor: 0.15,
    description: 'Conservation investment boosts adjacent lagoon fish nursery',
  },
];

// ── Flow Generators ──

/**
 * Generate a ValueFlow for resource extraction (consume action).
 * EUR amount = harvest proportion × zone commodity value.
 */
export function generateExtractionFlow(
  action: AgentAction,
  zone: TerritorialZone,
  harvestAmount: number,
  round: number,
): ValueFlow {
  const economics = zone.economics;
  if (!economics || zone.maxCapacity === 0) {
    return {
      id: uuid(),
      round,
      type: 'extraction',
      agentId: action.agentId,
      sourceZoneId: zone.id,
      commodityEUR: 0,
      ecosystemEUR: 0,
      netEUR: 0,
      description: `${action.agentId} extracted from ${zone.properties.libelle} (no economics data)`,
    };
  }

  const harvestProportion = harvestAmount / Math.max(zone.resourceLevel + harvestAmount, 1);
  const commodityEUR = harvestProportion * economics.totalCommodityValue;
  // Extraction also reduces ecosystem service capacity
  const ecosystemEUR = harvestProportion * economics.totalEcosystemValue;

  return {
    id: uuid(),
    round,
    type: 'extraction',
    agentId: action.agentId,
    sourceZoneId: zone.id,
    commodityEUR,
    ecosystemEUR: -ecosystemEUR,  // negative: services lost
    netEUR: commodityEUR - ecosystemEUR,
    description: `Extracted ${formatEUR(commodityEUR)} commodity from ${zone.properties.libelle}, degrading ${formatEUR(ecosystemEUR)} in ecosystem services`,
  };
}

/**
 * Generate a ValueFlow for resource contribution.
 * EUR amount = contribution proportion × ecosystem service recovery.
 */
export function generateContributionFlow(
  action: AgentAction,
  zone: TerritorialZone,
  contributionAmount: number,
  round: number,
): ValueFlow {
  const economics = zone.economics;
  if (!economics || zone.maxCapacity === 0) {
    return {
      id: uuid(),
      round,
      type: 'contribution',
      agentId: action.agentId,
      sourceZoneId: zone.id,
      commodityEUR: 0,
      ecosystemEUR: 0,
      netEUR: 0,
      description: `${action.agentId} contributed to ${zone.properties.libelle}`,
    };
  }

  // Contribution recovers ecosystem capacity
  const recoveryProportion = contributionAmount / Math.max(zone.maxCapacity, 1);
  const ecosystemRecovery = recoveryProportion * economics.totalEcosystemValue;

  return {
    id: uuid(),
    round,
    type: 'contribution',
    agentId: action.agentId,
    sourceZoneId: zone.id,
    commodityEUR: 0,
    ecosystemEUR: ecosystemRecovery,
    netEUR: ecosystemRecovery,
    description: `Contributed to ${zone.properties.libelle}, recovering ${formatEUR(ecosystemRecovery)} in ecosystem services`,
  };
}

/**
 * Generate externality ValueFlows for an action.
 * Checks EXTERNALITY_RULES for cross-zone impacts.
 */
export function generateExternalityFlows(
  action: AgentAction,
  sourceZone: TerritorialZone,
  territory: Territory,
  round: number,
): ValueFlow[] {
  const flows: ValueFlow[] = [];
  const actionType = action.type === 'consume' ? 'consume' : action.type === 'contribute' ? 'contribute' : null;
  if (!actionType) return flows;

  for (const rule of EXTERNALITY_RULES) {
    if (rule.triggerAction !== actionType) continue;
    if (rule.triggerCategory !== sourceZone.category) continue;

    // Find adjacent zones of the affected category
    const affectedZones = territory.zones.filter(
      (z) => sourceZone.adjacentZones.includes(z.id) && z.category === rule.affectedCategory,
    );

    for (const affected of affectedZones) {
      if (!affected.economics) continue;

      const serviceValue = affected.economics.currentServices[rule.affectedService] ?? 0;
      const impactEUR = serviceValue * rule.impactFactor;

      if (Math.abs(impactEUR) < 0.01) continue;

      flows.push({
        id: uuid(),
        round,
        type: 'externality',
        agentId: action.agentId,
        sourceZoneId: sourceZone.id,
        targetZoneId: affected.id,
        commodityEUR: 0,
        ecosystemEUR: impactEUR,
        netEUR: impactEUR,
        description: rule.description + ` (${formatEUR(Math.abs(impactEUR))})`,
      });
    }
  }

  return flows;
}

/**
 * Generate a ValueFlow for natural regeneration.
 */
export function generateRegenerationFlow(
  zone: TerritorialZone,
  regenAmount: number,
  round: number,
): ValueFlow {
  const economics = zone.economics;
  const recoveryProportion = economics && zone.maxCapacity > 0
    ? regenAmount / zone.maxCapacity
    : 0;
  const ecosystemRecovery = economics
    ? recoveryProportion * economics.totalEcosystemValue
    : 0;

  return {
    id: uuid(),
    round,
    type: 'regeneration',
    sourceZoneId: zone.id,
    commodityEUR: 0,
    ecosystemEUR: ecosystemRecovery,
    netEUR: ecosystemRecovery,
    description: `${zone.properties.libelle} regenerated ${formatEUR(ecosystemRecovery)} in ecosystem services`,
  };
}

// ── Agent Attribution ──

/**
 * Compute per-agent cumulative EUR value creation/destruction from value flows.
 */
export function computeAgentAttribution(
  valueFlows: ValueFlow[],
  agents: AgentState[],
): AgentAttribution[] {
  const attributionMap = new Map<string, AgentAttribution>();

  // Initialize for all agents
  for (const agent of agents) {
    attributionMap.set(agent.id, {
      agentId: agent.id,
      agentName: agent.name,
      totalExtractedEUR: 0,
      totalContributedEUR: 0,
      totalExternalityEUR: 0,
      netEcosystemImpactEUR: 0,
      netEconomicImpactEUR: 0,
    });
  }

  for (const flow of valueFlows) {
    if (!flow.agentId) continue;
    const attr = attributionMap.get(flow.agentId);
    if (!attr) continue;

    switch (flow.type) {
      case 'extraction':
        attr.totalExtractedEUR += flow.commodityEUR;
        attr.netEcosystemImpactEUR += flow.ecosystemEUR; // negative
        break;
      case 'contribution':
        attr.totalContributedEUR += flow.ecosystemEUR;
        attr.netEcosystemImpactEUR += flow.ecosystemEUR; // positive
        break;
      case 'externality':
        attr.totalExternalityEUR += flow.ecosystemEUR;
        attr.netEcosystemImpactEUR += flow.ecosystemEUR;
        break;
    }

    attr.netEconomicImpactEUR =
      attr.totalExtractedEUR +
      attr.totalContributedEUR +
      attr.totalExternalityEUR;
  }

  return Array.from(attributionMap.values());
}

// ── Helpers ──

function formatEUR(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

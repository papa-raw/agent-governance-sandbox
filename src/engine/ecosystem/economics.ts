/**
 * Ecosystem Services Valuation Engine
 *
 * Converts abstract resource levels into EUR-denominated ecosystem service values.
 * Based on Camargue-specific ecological economics data (PRD Section 8.5).
 *
 * Key tension: commodity production peaks at moderate health (healthFactor × 1.5, capped at 1),
 * while ecosystem services scale linearly with health. This means light degradation
 * can boost commodity output while destroying service value — the core tragedy dynamic.
 */

import type {
  LandUseCategory,
  TerritorialZone,
  Territory,
  ZoneEconomics,
  EcosystemServices,
} from '../../types';

// ── ZONE_ECONOMICS Lookup Table ──
// 9 land use categories × (commodityType + productionPerHa + 6 ecosystem services per ha)
// Values in EUR/ha/yr, derived from Camargue ecological economics literature

interface ZoneEconomicsConfig {
  commodityType: string;
  commodityValuePerHa: number;  // EUR/ha/yr at full productive capacity
  services: EcosystemServices;  // EUR/ha/yr at full ecosystem health
}

export const ZONE_ECONOMICS: Record<LandUseCategory, ZoneEconomicsConfig> = {
  /** @source SRFF production data: ~80M EUR/15,000 ha; rice paddies provide off-season bird habitat */
  agriculture: {
    commodityType: 'Rice (Camargue IGP)',
    commodityValuePerHa: 3500,
    services: {
      carbonSequestration: 120,
      waterPurification: 80,
      floodRegulation: 250,
      biodiversityHabitat: 180,   // off-season flooded paddies = bird habitat
      fishNursery: 20,
      recreationCultural: 200,    // agritourism, cultural landscape
    },
  },
  /** @source Salins Group annual reports; flamingo habitat in evaporation ponds */
  salt_production: {
    commodityType: 'Sea Salt (Fleur de Sel)',
    commodityValuePerHa: 3200,
    services: {
      carbonSequestration: 30,
      waterPurification: 120,
      floodRegulation: 80,
      biodiversityHabitat: 380,   // salt pans: flamingos, avocets, shorebirds
      fishNursery: 40,
      recreationCultural: 250,    // Salin-de-Giraud tourism, pink lakes
    },
  },
  /** @source Costanza et al. 2014: inland wetlands ~23,500 EUR/ha; conservative 50% for Camargue */
  wetland: {
    commodityType: 'Reed harvest',
    commodityValuePerHa: 150,
    services: {
      carbonSequestration: 2200,  // wetlands are premier carbon sinks
      waterPurification: 2800,    // primary water filtration for delta
      floodRegulation: 3200,      // flood buffer capacity (Med-ESCWET)
      biodiversityHabitat: 2000,  // critical habitat, UNESCO Biosphere
      fishNursery: 1000,          // spawning/nursery grounds
      recreationCultural: 800,    // birdwatching, scientific tourism
    },
  },
  /** @source Costanza et al. 2014: coastal wetlands up to 177K; conservative 8-10% for Camargue lagoons */
  lagoon: {
    commodityType: 'Fishery (Etang de Vaccarès)',
    commodityValuePerHa: 400,
    services: {
      carbonSequestration: 1500,
      waterPurification: 2800,
      floodRegulation: 2500,
      biodiversityHabitat: 3200,  // Vaccarès: 270+ bird species
      fishNursery: 3500,          // primary nursery for Mediterranean species
      recreationCultural: 1500,   // flagship landscape, flamingo observation
    },
  },
  /** @source Mediterranean forest ecosystem services literature; Plan Bleu */
  forest: {
    commodityType: 'Timber / Non-timber products',
    commodityValuePerHa: 300,
    services: {
      carbonSequestration: 1200,
      waterPurification: 800,
      floodRegulation: 600,
      biodiversityHabitat: 1100,
      fishNursery: 0,
      recreationCultural: 800,
    },
  },
  urban: {
    commodityType: 'Built infrastructure',
    commodityValuePerHa: 5000,
    services: {
      carbonSequestration: 2,
      waterPurification: 0,
      floodRegulation: -20,       // impervious surfaces increase flood risk
      biodiversityHabitat: 5,
      fishNursery: 0,
      recreationCultural: 80,
    },
  },
  /** @source Med-ESCWET: centennial storm protection ~2.3M EUR single event; annual amortized + dune services */
  coastal: {
    commodityType: 'Tourism / Beach access',
    commodityValuePerHa: 1200,
    services: {
      carbonSequestration: 100,
      waterPurification: 200,
      floodRegulation: 1500,      // dune/barrier storm protection
      biodiversityHabitat: 500,
      fishNursery: 300,
      recreationCultural: 900,    // Saintes-Maries beach tourism
    },
  },
  /** @source Manades cultural valuation; low-intensity grazing biodiversity (Mesléard et al.) */
  grassland: {
    commodityType: 'Livestock (Camargue bulls/horses)',
    commodityValuePerHa: 600,
    services: {
      carbonSequestration: 250,
      waterPurification: 150,
      floodRegulation: 180,
      biodiversityHabitat: 400,
      fishNursery: 0,
      recreationCultural: 820,    // manades since 1512, equestrian tourism, cultural heritage
    },
  },
  /** @source Similar to wetland; highest biodiversity density in Réserve Nationale */
  protected: {
    commodityType: 'None (conservation)',
    commodityValuePerHa: 0,
    services: {
      carbonSequestration: 2500,
      waterPurification: 2600,
      floodRegulation: 2800,
      biodiversityHabitat: 3500,  // highest biodiversity value in Camargue
      fishNursery: 1200,
      recreationCultural: 1400,   // scientific research, eco-tourism
    },
  },
  /** @source Campagne & Thiébaut 2021: Posidonia meadows 1,300-12,900 EUR/ha; Vassallo et al. 2013 */
  nearshore: {
    commodityType: 'Small-scale fishery',
    commodityValuePerHa: 250,
    services: {
      carbonSequestration: 1800,  // Posidonia: 15% of global ocean carbon storage
      waterPurification: 1200,
      floodRegulation: 800,       // wave attenuation by seagrass
      biodiversityHabitat: 3800,  // Posidonia meadows: keystone Mediterranean habitat
      fishNursery: 4500,          // primary nursery for 30%+ of Med commercial species
      recreationCultural: 1600,   // diving, snorkelling, marine ecotourism
    },
  },
  /** @source IFREMER Rhône plume studies; Darnaude et al. 2004 fish nursery function */
  estuary: {
    commodityType: 'Estuarine fishery',
    commodityValuePerHa: 350,
    services: {
      carbonSequestration: 800,
      waterPurification: 3500,    // massive nutrient processing at freshwater/saltwater interface
      floodRegulation: 1200,      // river discharge buffering
      biodiversityHabitat: 2800,  // mixing zone supports unique assemblages
      fishNursery: 5000,          // highest nursery value — sole, sea bass, eel migration
      recreationCultural: 600,    // limited access, mostly scientific
    },
  },
};

// ── Methodology & Source Annotations ──

export interface MethodologyEntry {
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export const METHODOLOGY: Record<LandUseCategory, MethodologyEntry> = {
  agriculture: {
    sources: ['SRFF (Syndicat des Riziculteurs de France et Filière)', 'CFR production data'],
    confidence: 'high',
    notes: 'Commodity: ~80M EUR/15,000 ha. Ecosystem services from off-season flooded paddies providing bird habitat and water retention.',
  },
  salt_production: {
    sources: ['Salins Group annual reports', 'Tour du Valat flamingo census data'],
    confidence: 'high',
    notes: 'Commodity: 22,000 ha managed. Evaporation ponds are critical flamingo breeding habitat (>10,000 pairs).',
  },
  wetland: {
    sources: ['Costanza et al. 2014 (Nature)', 'Med-ESCWET / Plan Bleu'],
    confidence: 'medium',
    notes: 'Costanza 2014 values inland wetlands at ~23,500 EUR/ha. We apply 50% discount for Camargue-specific context (12,000 EUR/ha).',
  },
  lagoon: {
    sources: ['Costanza et al. 2014 (Nature)', 'Prud\'homies de Pêche fishery records'],
    confidence: 'medium',
    notes: 'Costanza 2014 values coastal wetlands up to 177K EUR/ha. Conservative 8-10% applied (15,000 EUR/ha) given Vaccarès ecological significance.',
  },
  forest: {
    sources: ['Plan Bleu Mediterranean forest valuation', 'INRAE forest services literature'],
    confidence: 'medium',
    notes: 'Mediterranean riparian and gallery forests. Lower density than boreal but high biodiversity and cultural value.',
  },
  urban: {
    sources: ['INSEE commune data'],
    confidence: 'high',
    notes: 'Built infrastructure with minimal ecosystem service provision. Negative flood regulation from impervious surfaces.',
  },
  coastal: {
    sources: ['Med-ESCWET centennial storm valuation', 'DREAL PACA coastal risk assessment'],
    confidence: 'medium',
    notes: 'Storm protection: single centennial event ~2.3M EUR. Annualized with dune/barrier beach services.',
  },
  grassland: {
    sources: ['Mesléard et al. (Tour du Valat)', 'Confrérie des Gardians cultural assessment'],
    confidence: 'medium',
    notes: 'Manades tradition since 1512. Low-intensity grazing maintains biodiversity. High cultural/recreational value.',
  },
  protected: {
    sources: ['Costanza et al. 2014 (Nature)', 'SNPN Réserve Nationale monitoring data'],
    confidence: 'medium',
    notes: 'Highest biodiversity density. Similar methodology to wetland valuation. Réserve Nationale de Camargue = 13,117 ha.',
  },
  nearshore: {
    sources: ['Campagne & Thiébaut 2021 (Marine Pollution Bulletin)', 'Vassallo et al. 2013', 'Pergent et al. 2014 Posidonia monitoring'],
    confidence: 'medium',
    notes: 'Posidonia oceanica meadows valued at 1,300-12,900 EUR/ha depending on methodology. Fish nursery is the dominant service — 30%+ of Med commercial species depend on seagrass nurseries.',
  },
  estuary: {
    sources: ['IFREMER Rhône plume programme', 'Darnaude et al. 2004 (Marine Ecology Progress Series)', 'PNMGL management plan 2021'],
    confidence: 'medium',
    notes: 'Grand Rhône estuary: 1,800 m³/s mean discharge. Freshwater-saltwater mixing zone with exceptional nutrient processing and fish nursery function. Governed under Parc naturel marin du Golfe du Lion.',
  },
};

// ── Service Names for Display ──

export const SERVICE_LABELS: Record<string, string> = {
  carbonSequestration: 'Carbon Sequestration',
  waterPurification: 'Water Purification',
  floodRegulation: 'Flood Regulation',
  biodiversityHabitat: 'Biodiversity Habitat',
  fishNursery: 'Fish Nursery',
  recreationCultural: 'Recreation & Cultural',
};

// ── Computation Functions ──

/**
 * Compute EUR-denominated economics for a single zone.
 *
 * healthFactor = resourceLevel / maxCapacity
 * Commodity production scales with min(1, healthFactor × 1.5) — light degradation doesn't hurt output
 * Ecosystem services scale linearly with healthFactor — any degradation reduces services
 * Neighbor bonus adds 10% for water_purification, fish_nursery, biodiversity from healthy adjacent natural zones
 */
export function computeZoneEconomics(
  zone: TerritorialZone,
  allZones?: TerritorialZone[],
): ZoneEconomics {
  const config = ZONE_ECONOMICS[zone.category];
  const areaHa = zone.properties.surface_ha;
  const healthFactor = zone.maxCapacity > 0
    ? zone.resourceLevel / zone.maxCapacity
    : 0;

  // Commodity: peaks at moderate health — the fundamental tension
  const commodityHealth = Math.min(1, healthFactor * 1.5);
  const commodityValuePerHa = config.commodityValuePerHa;
  const totalCommodityValue = commodityValuePerHa * areaHa * commodityHealth;

  // Ecosystem services: linear with health
  const baseServices = scaleServices(config.services, areaHa * healthFactor);

  // Neighbor bonus: healthy adjacent natural zones boost certain services
  const neighborBonus = computeNeighborBonus(zone, allZones);
  const currentServices = addServices(baseServices, neighborBonus);

  const totalEcosystemValue = sumServices(currentServices);

  return {
    commodityType: config.commodityType,
    commodityValuePerHa,
    totalCommodityValue,
    servicesPerHa: config.services,
    currentServices,
    totalEcosystemValue,
    totalValue: totalCommodityValue + totalEcosystemValue,
    healthFactor,
  };
}

/**
 * Compute territory-level economic aggregates from all zone economics.
 */
export function computeTerritoryEconomics(territory: Territory): {
  totalCommodityValue: number;
  totalEcosystemValue: number;
  totalTerritorialCapital: number;
} {
  let totalCommodityValue = 0;
  let totalEcosystemValue = 0;

  for (const zone of territory.zones) {
    if (zone.economics) {
      totalCommodityValue += zone.economics.totalCommodityValue;
      totalEcosystemValue += zone.economics.totalEcosystemValue;
    }
  }

  return {
    totalCommodityValue,
    totalEcosystemValue,
    totalTerritorialCapital: totalCommodityValue + totalEcosystemValue,
  };
}

/**
 * Recompute economics for all zones in a territory, then aggregate.
 */
export function recomputeAllEconomics(territory: Territory): void {
  for (const zone of territory.zones) {
    zone.economics = computeZoneEconomics(zone, territory.zones);
  }
  const agg = computeTerritoryEconomics(territory);
  territory.totalCommodityValue = agg.totalCommodityValue;
  territory.totalEcosystemValue = agg.totalEcosystemValue;
  territory.totalTerritorialCapital = agg.totalTerritorialCapital;
}

// ── Helper Functions ──

function scaleServices(services: EcosystemServices, factor: number): EcosystemServices {
  return {
    carbonSequestration: services.carbonSequestration * factor,
    waterPurification: services.waterPurification * factor,
    floodRegulation: services.floodRegulation * factor,
    biodiversityHabitat: services.biodiversityHabitat * factor,
    fishNursery: services.fishNursery * factor,
    recreationCultural: services.recreationCultural * factor,
  };
}

function addServices(a: EcosystemServices, b: EcosystemServices): EcosystemServices {
  return {
    carbonSequestration: a.carbonSequestration + b.carbonSequestration,
    waterPurification: a.waterPurification + b.waterPurification,
    floodRegulation: a.floodRegulation + b.floodRegulation,
    biodiversityHabitat: a.biodiversityHabitat + b.biodiversityHabitat,
    fishNursery: a.fishNursery + b.fishNursery,
    recreationCultural: a.recreationCultural + b.recreationCultural,
  };
}

export function sumServices(services: EcosystemServices): number {
  return (
    services.carbonSequestration +
    services.waterPurification +
    services.floodRegulation +
    services.biodiversityHabitat +
    services.fishNursery +
    services.recreationCultural
  );
}

const NATURAL_CATEGORIES = new Set<LandUseCategory>([
  'wetland', 'lagoon', 'forest', 'coastal', 'protected', 'nearshore', 'estuary',
]);

/**
 * Compute neighbor bonus: healthy adjacent natural zones boost
 * waterPurification, fishNursery, and biodiversityHabitat by up to 10%.
 */
function computeNeighborBonus(
  zone: TerritorialZone,
  allZones?: TerritorialZone[],
): EcosystemServices {
  const empty: EcosystemServices = {
    carbonSequestration: 0,
    waterPurification: 0,
    floodRegulation: 0,
    biodiversityHabitat: 0,
    fishNursery: 0,
    recreationCultural: 0,
  };

  if (!allZones || zone.adjacentZones.length === 0) return empty;

  const adjacentNatural = allZones.filter(
    (z) => zone.adjacentZones.includes(z.id) && NATURAL_CATEGORIES.has(z.category),
  );

  if (adjacentNatural.length === 0) return empty;

  // Average health of adjacent natural zones
  const avgHealth = adjacentNatural.reduce((sum, z) => {
    return sum + (z.maxCapacity > 0 ? z.resourceLevel / z.maxCapacity : 0);
  }, 0) / adjacentNatural.length;

  // Bonus: up to 10% of base service value, scaled by neighbor health
  const config = ZONE_ECONOMICS[zone.category];
  const areaHa = zone.properties.surface_ha;
  const bonusFactor = 0.10 * avgHealth * areaHa;

  return {
    carbonSequestration: 0,
    waterPurification: config.services.waterPurification * bonusFactor,
    floodRegulation: 0,
    biodiversityHabitat: config.services.biodiversityHabitat * bonusFactor,
    fishNursery: config.services.fishNursery * bonusFactor,
    recreationCultural: 0,
  };
}

/**
 * Get the top ecosystem service for a zone (for tooltip display).
 */
export function getTopService(economics: ZoneEconomics): { name: string; value: number } | null {
  const services = economics.currentServices;
  const entries: [string, number][] = [
    ['carbonSequestration', services.carbonSequestration],
    ['waterPurification', services.waterPurification],
    ['floodRegulation', services.floodRegulation],
    ['biodiversityHabitat', services.biodiversityHabitat],
    ['fishNursery', services.fishNursery],
    ['recreationCultural', services.recreationCultural],
  ];

  const top = entries.reduce((best, entry) =>
    entry[1] > best[1] ? entry : best,
  );

  if (top[1] <= 0) return null;
  return { name: SERVICE_LABELS[top[0]] ?? top[0], value: top[1] };
}

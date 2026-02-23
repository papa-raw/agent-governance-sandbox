import type { Territory } from '../../types';

/**
 * Density-dependent regeneration (from Janssen's spatial commons experiments).
 *
 * A zone's regeneration rate is proportional to the health of its neighbors.
 * Depleted zones spread — a harvested zone surrounded by harvested zones
 * regenerates slowly or not at all. Healthy zones reinforce each other.
 */
export function regenerateTerritory(territory: Territory): Territory {
  const zoneMap = new Map(territory.zones.map((z) => [z.id, z]));

  const updatedZones = territory.zones.map((zone) => {
    // Compute neighbor health average
    const neighbors = zone.adjacentZones
      .map((id) => zoneMap.get(id))
      .filter((z): z is NonNullable<typeof z> => z != null);

    const neighborHealthAvg = neighbors.length > 0
      ? neighbors.reduce((sum, n) => sum + n.resourceLevel / n.maxCapacity, 0) / neighbors.length
      : 0.5; // Default to moderate if no neighbors

    // Base regeneration modified by neighbor health
    // - Healthy neighbors boost regeneration (up to 1.5x base rate)
    // - Depleted neighbors reduce regeneration (down to 0.2x base rate)
    const neighborModifier = 0.2 + 1.3 * neighborHealthAvg;

    // Logistic growth: resources grow fastest at intermediate levels
    // r * R * (1 - R/K) where R = current, K = capacity
    const logisticGrowth =
      zone.regenerationRate * zone.resourceLevel * (1 - zone.resourceLevel / Math.max(zone.maxCapacity, 1));

    // Apply neighbor modifier and normalize
    const regeneration = Math.max(0, logisticGrowth * neighborModifier / Math.max(zone.maxCapacity, 1));

    // Reset harvest pressure for next round
    const newResourceLevel = Math.min(
      zone.maxCapacity,
      Math.max(0, zone.resourceLevel + regeneration),
    );

    // Land use degradation: if resources drop below 10%, category may shift
    let category = zone.category;
    if (newResourceLevel / zone.maxCapacity < 0.1 && zone.category !== 'urban' && zone.category !== 'lagoon') {
      // Degraded zones become less productive
      category = zone.category; // Keep category but resources reflect degradation
    }

    return {
      ...zone,
      resourceLevel: newResourceLevel,
      harvestPressure: 0, // Reset for next round
      category,
    };
  });

  return {
    ...territory,
    zones: updatedZones,
  };
}

import { v4 as uuid } from 'uuid';
import type { Territory, TerritorialZone, LandUseCategory } from '../types';

/**
 * Map GeoJSON zone types to our simulation land use categories.
 */
const ZONE_TO_CATEGORY: Record<string, LandUseCategory> = {
  lagoon: 'lagoon',
  rice_paddy: 'agriculture',
  salt_pond: 'salt_production',
  wetland: 'wetland',
  forest: 'forest',
  urban: 'urban',
  sansouire: 'wetland',      // salty marshland → wetland
  pasture: 'grassland',
  beach: 'coastal',
  coastal: 'coastal',
};

/**
 * Base regeneration rates by land use category.
 */
const REGEN_RATES: Record<LandUseCategory, number> = {
  agriculture: 0.3,        // Low — needs active management
  salt_production: 0.1,    // Very low — industrial
  wetland: 0.8,            // High — natural regeneration
  lagoon: 0.6,             // Moderate — water cycling
  forest: 0.7,             // High — natural growth
  urban: 0.05,             // Minimal
  coastal: 0.4,            // Moderate — dune dynamics
  grassland: 0.5,          // Moderate — grazing pressure
  protected: 0.9,          // Highest — no extraction allowed
};

/**
 * Build a Territory from GeoJSON data.
 * Converts raw GeoJSON features into simulation-ready TerritorialZones.
 */
export function buildTerritoryFromGeoJSON(geojson: GeoJSON.FeatureCollection): Territory {
  const zones: TerritorialZone[] = geojson.features.map((feature) => {
    const props = feature.properties ?? {};
    const zoneType = props.zone ?? props.classe ?? 'wetland';
    const category = ZONE_TO_CATEGORY[zoneType] ?? 'wetland';
    const areaHa = props.area_ha ?? props.surface_ha ?? 100;

    // Resource capacity proportional to area, modified by land type
    const baseCapacity = areaHa * 0.1; // 10 resource units per hectare
    const categoryMultiplier = category === 'lagoon' ? 1.5 :
      category === 'wetland' ? 1.3 :
      category === 'forest' ? 1.2 :
      category === 'agriculture' ? 0.8 :
      category === 'salt_production' ? 0.6 :
      category === 'urban' ? 0.2 : 1.0;

    const maxCapacity = Math.round(baseCapacity * categoryMultiplier);

    return {
      id: props.id ?? uuid(),
      geometry: feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      properties: {
        code_occ: props.code_occ ?? zoneType,
        libelle: props.name ?? props.libelle ?? zoneType,
        classe: props.zone ?? props.classe ?? zoneType,
        surface_ha: areaHa,
      },
      category,
      resourceLevel: maxCapacity * 0.8, // Start at 80% capacity
      maxCapacity,
      steward: 'commons',
      harvestPressure: 0,
      regenerationRate: REGEN_RATES[category],
      adjacentZones: [], // Computed after all zones are created
    };
  });

  // Compute adjacency (simplified: zones are adjacent if they share a similar area)
  // In production, this would use turf.js to detect shared boundaries
  computeAdjacency(zones);

  const totalResources = zones.reduce((sum, z) => sum + z.resourceLevel, 0);

  return {
    zones,
    totalResources,
    biodiversityIndex: computeInitialBiodiversity(zones),
    giniCoefficient: 0, // No agent inequality at start
    sustainabilityScore: 100, // Pristine at start
    waterBalance: 0.5, // Balanced freshwater/saltwater
  };
}

/**
 * Compute zone adjacency using bounding box overlap.
 * A simple heuristic until real topology is available.
 */
function computeAdjacency(zones: TerritorialZone[]) {
  for (let i = 0; i < zones.length; i++) {
    const bboxA = getBoundingBox(zones[i].geometry);

    for (let j = i + 1; j < zones.length; j++) {
      const bboxB = getBoundingBox(zones[j].geometry);

      // Check if bounding boxes overlap or are close (within 0.02 degrees ≈ 2km)
      const buffer = 0.02;
      if (
        bboxA.minX - buffer <= bboxB.maxX &&
        bboxA.maxX + buffer >= bboxB.minX &&
        bboxA.minY - buffer <= bboxB.maxY &&
        bboxA.maxY + buffer >= bboxB.minY
      ) {
        zones[i].adjacentZones.push(zones[j].id);
        zones[j].adjacentZones.push(zones[i].id);
      }
    }
  }
}

function getBoundingBox(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const coords = geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.coordinates.flat();

  for (const ring of coords) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return { minX, minY, maxX, maxY };
}

function computeInitialBiodiversity(zones: TerritorialZone[]): number {
  const categories = new Set(zones.map((z) => z.category));
  // Shannon diversity approximation — more unique categories = higher biodiversity
  return Math.min(100, (categories.size / 9) * 100);
}

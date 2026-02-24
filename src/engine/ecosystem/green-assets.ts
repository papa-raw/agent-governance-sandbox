/**
 * Green Asset Potential Mapper
 *
 * Maps ecosystem services to green asset classes from the Regen Atlas taxonomy:
 * - Carbon Credits (tCO2e) from carbonSequestration
 * - Biodiversity Credits (ha-eq) from biodiversityHabitat
 * - Water Quality Certificates (m3-eq) from waterPurification
 * - Ecosystem Service Payments (EUR) from floodRegulation + fishNursery + recreationCultural
 *
 * Shows what green assets COULD be backed by the territory's ecosystem services
 * if the governance regime preserves them. Tragedy destroys the backing.
 * Ostrom preserves it. This is the bridge between Submission A (Regen Atlas)
 * and Submission B (Governance Sandbox).
 */

import type {
  Territory,
  TerritoryGreenAssets,
  GreenAssetPotential,
  GreenAssetClass,
} from '../../types';
import { ZONE_ECONOMICS } from './economics';

// ── Asset Class Configuration ──

interface AssetClassConfig {
  assetClass: GreenAssetClass;
  label: string;
  nativeUnit: string;
  pricePerUnit: number;     // EUR per native unit
  serviceKey: string;       // which EcosystemServiceType feeds this asset
  eurToUnitFactor: number;  // convert EUR service value to native units
}

const ASSET_CLASSES: AssetClassConfig[] = [
  {
    assetClass: 'carbon_credit',
    label: 'Carbon Credit',
    nativeUnit: 'tCO2e',
    pricePerUnit: 70,        // EU ETS ~70 EUR/tonne
    serviceKey: 'carbonSequestration',
    eurToUnitFactor: 1 / 70, // 70 EUR/tCO2e → 1 tonne per 70 EUR of service
  },
  {
    assetClass: 'biodiversity_credit',
    label: 'Biodiversity Credit',
    nativeUnit: 'ha-eq',
    pricePerUnit: 35,
    serviceKey: 'biodiversityHabitat',
    eurToUnitFactor: 1 / 35,
  },
  {
    assetClass: 'water_quality_certificate',
    label: 'Water Quality Certificate',
    nativeUnit: 'm3-eq',
    pricePerUnit: 0.50,
    serviceKey: 'waterPurification',
    eurToUnitFactor: 1 / 0.50,
  },
  {
    assetClass: 'ecosystem_service_payment',
    label: 'Ecosystem Service Payment',
    nativeUnit: 'EUR',
    pricePerUnit: 1,
    // This is a composite: floodRegulation + fishNursery + recreationCultural
    serviceKey: '_composite',
    eurToUnitFactor: 1,
  },
];

// ── Computation ──

/**
 * Compute green asset potential for the entire territory.
 * Compares full-health potential vs. current health to show what governance has preserved/destroyed.
 */
export function computeGreenAssetPotential(territory: Territory): TerritoryGreenAssets {
  const assets: GreenAssetPotential[] = ASSET_CLASSES.map((config) => {
    let fullHealthEUR = 0;
    let currentEUR = 0;
    const sourceZoneIds: string[] = [];

    for (const zone of territory.zones) {
      const zoneConfig = ZONE_ECONOMICS[zone.category];
      const areaHa = zone.properties.surface_ha;

      // Full health: service per ha × area
      let zoneFullHealthServiceEUR: number;
      let zoneCurrentServiceEUR: number;

      if (config.serviceKey === '_composite') {
        // Composite: sum of floodRegulation + fishNursery + recreationCultural
        zoneFullHealthServiceEUR =
          (zoneConfig.services.floodRegulation +
            zoneConfig.services.fishNursery +
            zoneConfig.services.recreationCultural) * areaHa;

        if (zone.economics) {
          zoneCurrentServiceEUR =
            zone.economics.currentServices.floodRegulation +
            zone.economics.currentServices.fishNursery +
            zone.economics.currentServices.recreationCultural;
        } else {
          const healthFactor = zone.maxCapacity > 0
            ? zone.resourceLevel / zone.maxCapacity
            : 0;
          zoneCurrentServiceEUR = zoneFullHealthServiceEUR * healthFactor;
        }
      } else {
        const servicePerHa = zoneConfig.services[config.serviceKey as keyof typeof zoneConfig.services] ?? 0;
        zoneFullHealthServiceEUR = servicePerHa * areaHa;

        if (zone.economics) {
          zoneCurrentServiceEUR = zone.economics.currentServices[config.serviceKey as keyof typeof zone.economics.currentServices] ?? 0;
        } else {
          const healthFactor = zone.maxCapacity > 0
            ? zone.resourceLevel / zone.maxCapacity
            : 0;
          zoneCurrentServiceEUR = zoneFullHealthServiceEUR * healthFactor;
        }
      }

      if (zoneFullHealthServiceEUR > 0) {
        sourceZoneIds.push(zone.id);
      }

      fullHealthEUR += zoneFullHealthServiceEUR;
      currentEUR += zoneCurrentServiceEUR;
    }

    const lostEUR = fullHealthEUR - currentEUR;
    const totalUnits = fullHealthEUR * config.eurToUnitFactor;
    const currentUnits = currentEUR * config.eurToUnitFactor;
    const lostUnits = lostEUR * config.eurToUnitFactor;

    return {
      assetClass: config.assetClass,
      label: config.label,
      nativeUnit: config.nativeUnit,
      pricePerUnit: config.pricePerUnit,
      totalUnitsAtFullHealth: totalUnits,
      currentUnits,
      lostUnits,
      totalEUR: fullHealthEUR,
      currentEUR,
      lostEUR,
      sourceZoneIds,
    };
  });

  const totalAnnualPotentialEUR = assets.reduce((s, a) => s + a.totalEUR, 0);
  const preservedPotentialEUR = assets.reduce((s, a) => s + a.currentEUR, 0);
  const lostPotentialEUR = assets.reduce((s, a) => s + a.lostEUR, 0);

  return {
    assets,
    totalAnnualPotentialEUR,
    preservedPotentialEUR,
    lostPotentialEUR,
  };
}

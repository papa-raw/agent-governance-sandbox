import { useState, useMemo, useCallback } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { Source, Layer } from 'react-map-gl/maplibre';
import { centroid } from '@turf/turf';
import {
  Fish,
  Tree,
  Plant,
  Horse,
  SunHorizon,
  Diamond,
  Grains,
  Drop,
  Leaf,
  Bird,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react';
import {
  COMMODITY_TYPES,
  COMMODITY_TYPE_IDS,
  type CommodityTypeId,
} from '../data/commodity-types';
import type { Territory, ZoneEconomics, ValueFlow } from '../types';
import camargueData from '../data/camargue.json';

// ── Tooltip data passed up to TerritoryMap ──

export interface CommodityTooltipData {
  zoneId: string;
  zoneName: string;
  zoneType: string;
  area_ha: number;
  commodities: { typeId: CommodityTypeId; name: string; color: string; icon: string; metric: string; rea: { resource: string; event: string; agent: string } }[];
  economics?: ZoneEconomics;
  health: number | null;
  harvestPressure: number;
  regenerationRate: number;
  steward?: string;
}

// ── Zone legend (merged from TerritoryMap) ──

const ZONE_LEGEND: [string, string][] = [
  ['lagoon', '#3A8FBF'],
  ['rice paddy', '#f0e68c'],
  ['salt pond', '#ff6b6b'],
  ['wetland', '#4ecdc4'],
  ['forest', '#5AAE54'],
  ['urban', '#B0BEC5'],
  ['sansouire', '#D4A96A'],
  ['pasture', '#7dcea0'],
  ['beach', '#f5e6cc'],
  ['nearshore', '#2A7FAF'],
  ['estuary', '#5BA8C0'],
];

// ── Icon map ──

const ICON_MAP: Record<string, typeof Fish> = {
  Fish,
  Tree,
  Plant,
  Horse,
  SunHorizon,
  Diamond,
  Grains,
  Drop,
  Leaf,
  Bird,
};

// ── Split type IDs by category for legend rendering ──

const COMMODITY_IDS = COMMODITY_TYPE_IDS.filter((id) => COMMODITY_TYPES[id].category === 'commodity');
const ES_IDS = COMMODITY_TYPE_IDS.filter((id) => COMMODITY_TYPES[id].category === 'ecosystem_service');

// ── Zone-level cluster data (one cluster per zone, all matching types) ──

interface ZoneCluster {
  zoneId: string;
  zoneName: string;
  zoneType: string;
  area_ha: number;
  lng: number;
  lat: number;
  types: CommodityTypeId[];
}

/** Pre-compute one cluster per zone from GeoJSON — only runs once */
function buildZoneClusters(): ZoneCluster[] {
  const features = (camargueData as GeoJSON.FeatureCollection).features;
  const clusterMap = new Map<string, ZoneCluster>();

  for (const feature of features) {
    const zoneType = feature.properties?.zone as string;
    const featureId = String(feature.properties?.id ?? Math.random().toString(36).slice(2));

    // Find all types that match this zone
    const matchedTypes = COMMODITY_TYPE_IDS.filter((typeId) =>
      COMMODITY_TYPES[typeId].sourceZones.includes(zoneType),
    );
    if (matchedTypes.length === 0) continue;

    if (!clusterMap.has(featureId)) {
      try {
        const center = centroid(feature as GeoJSON.Feature);
        const [lng, lat] = center.geometry.coordinates;
        clusterMap.set(featureId, {
          zoneId: featureId,
          zoneName: feature.properties?.name ?? zoneType,
          zoneType,
          area_ha: feature.properties?.area_ha ?? 0,
          lng,
          lat,
          types: matchedTypes,
        });
      } catch {
        continue;
      }
    }
  }

  return Array.from(clusterMap.values());
}

const ALL_CLUSTERS = buildZoneClusters();

/** Exported centroids for arc endpoints */
export const ZONE_CENTROIDS: Map<string, [number, number]> = new Map(
  ALL_CLUSTERS.map((c) => [c.zoneId, [c.lng, c.lat]]),
);

// Also compute centroids for zones without any markers (e.g. urban)
(() => {
  const features = (camargueData as GeoJSON.FeatureCollection).features;
  for (const feature of features) {
    const featureId = String(feature.properties?.id ?? '');
    if (!featureId || ZONE_CENTROIDS.has(featureId)) continue;
    try {
      const center = centroid(feature as GeoJSON.Feature);
      const [lng, lat] = center.geometry.coordinates;
      ZONE_CENTROIDS.set(featureId, [lng, lat]);
    } catch {
      // skip
    }
  }
})();

/** Health color: green > 0.6, amber 0.3–0.6, red < 0.3 */
function healthColor(h: number): string {
  if (h > 0.6) return '#2ECC71';
  if (h > 0.3) return '#F1C40F';
  return '#E74C3C';
}

// ── Externality flow arc geometry ──

/** Quadratic bezier interpolated into a polyline for GeoJSON */
function buildArcCoords(
  from: [number, number],
  to: [number, number],
  segments: number = 20,
): [number, number][] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  // Perpendicular offset (30% of distance), always same side relative to direction
  const offsetFraction = 0.3;
  const mx = (from[0] + to[0]) / 2 + (-dy) * offsetFraction;
  const my = (from[1] + to[1]) / 2 + dx * offsetFraction;

  const coords: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const x = u * u * from[0] + 2 * u * t * mx + t * t * to[0];
    const y = u * u * from[1] + 2 * u * t * my + t * t * to[1];
    coords.push([x, y]);
  }
  return coords;
}

function buildArcGeoJSON(flows: ValueFlow[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const flow of flows) {
    if (flow.type !== 'externality' || !flow.targetZoneId) continue;
    const fromCoord = ZONE_CENTROIDS.get(flow.sourceZoneId);
    const toCoord = ZONE_CENTROIDS.get(flow.targetZoneId);
    if (!fromCoord || !toCoord) continue;

    const isBenefit = flow.ecosystemEUR > 0;
    const magnitude = Math.abs(flow.ecosystemEUR);

    features.push({
      type: 'Feature',
      properties: {
        flowType: isBenefit ? 'benefit' : 'damage',
        magnitude,
        description: flow.description,
      },
      geometry: {
        type: 'LineString',
        coordinates: buildArcCoords(fromCoord, toCoord),
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

// ── Component ──

interface Props {
  territory?: Territory;
  onTooltipChange?: (data: CommodityTooltipData | null) => void;
  onTooltipLock?: (data: CommodityTooltipData) => void;
  isTooltipActive?: boolean;
}

export function CommodityMarkers({ territory, onTooltipChange, onTooltipLock, isTooltipActive }: Props) {
  const [activeTypes, setActiveTypes] = useState<Set<CommodityTypeId>>(new Set());
  const [zonesOpen, setZonesOpen] = useState(true);
  const [commoditiesOpen, setCommoditiesOpen] = useState(true);
  const [esOpen, setEsOpen] = useState(true);
  const [showFlows, setShowFlows] = useState(false);

  const toggleType = useCallback((typeId: CommodityTypeId) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) {
        next.delete(typeId);
      } else {
        next.add(typeId);
      }
      return next;
    });
  }, []);

  /** Clusters filtered to only include active types, omitting empty ones */
  const visibleClusters = useMemo(() => {
    if (activeTypes.size === 0) return [];
    return ALL_CLUSTERS
      .map((cluster) => ({
        ...cluster,
        types: cluster.types.filter((t) => activeTypes.has(t)),
      }))
      .filter((cluster) => cluster.types.length > 0);
  }, [activeTypes]);

  /** Count zones per type (from all clusters) */
  const typeCounts = useMemo(() => {
    const counts: Record<CommodityTypeId, number> = {} as any;
    for (const id of COMMODITY_TYPE_IDS) {
      counts[id] = ALL_CLUSTERS.filter((c) => c.types.includes(id)).length;
    }
    return counts;
  }, []);

  /** Lookup zone health (0-1) from live simulation state */
  const getZoneHealth = useCallback(
    (zoneId: string): number | null => {
      if (!territory) return null;
      const zone = territory.zones.find((z) => z.id === zoneId);
      if (!zone || zone.maxCapacity <= 0) return null;
      return zone.resourceLevel / zone.maxCapacity;
    },
    [territory],
  );

  /** Build tooltip data for a cluster */
  const buildTooltipData = useCallback(
    (cluster: ZoneCluster, focusType?: CommodityTypeId): CommodityTooltipData => {
      const typeIds = focusType
        ? [focusType]
        : cluster.types.filter((t) => activeTypes.has(t));
      const simZone = territory?.zones.find((z) => z.id === cluster.zoneId);
      return {
        zoneId: cluster.zoneId,
        zoneName: cluster.zoneName,
        zoneType: cluster.zoneType,
        area_ha: cluster.area_ha,
        commodities: typeIds.map((id) => {
          const cfg = COMMODITY_TYPES[id];
          return { typeId: id, name: cfg.name, color: cfg.color, icon: cfg.icon, metric: cfg.metric, rea: cfg.rea };
        }),
        economics: simZone?.economics,
        health: simZone && simZone.maxCapacity > 0 ? simZone.resourceLevel / simZone.maxCapacity : null,
        harvestPressure: simZone?.harvestPressure ?? 0,
        regenerationRate: simZone?.regenerationRate ?? 0,
        steward: simZone?.steward,
      };
    },
    [territory, activeTypes],
  );

  /** Externality flow arcs GeoJSON */
  const externalityFlows = useMemo(() => {
    if (!territory?.valueFlows) return [];
    return territory.valueFlows.filter((f) => f.type === 'externality' && f.targetZoneId);
  }, [territory?.valueFlows]);

  const arcGeoJSON = useMemo(() => {
    if (externalityFlows.length === 0) return null;
    return buildArcGeoJSON(externalityFlows);
  }, [externalityFlows]);

  /** Effective open state — collapse legends when tooltip is active */
  const effectiveZonesOpen = zonesOpen && !isTooltipActive;
  const effectiveCommoditiesOpen = commoditiesOpen && !isTooltipActive;
  const effectiveEsOpen = esOpen && !isTooltipActive;

  /** Render a legend toggle row */
  const renderToggle = (typeId: CommodityTypeId) => {
    const config = COMMODITY_TYPES[typeId];
    const Icon = ICON_MAP[config.icon] ?? Grains;
    const isActive = activeTypes.has(typeId);

    return (
      <button
        key={typeId}
        onClick={() => toggleType(typeId)}
        className={`flex items-center gap-2 px-1.5 py-1 rounded text-left transition-all ${
          isActive
            ? 'bg-white/10'
            : 'opacity-50 hover:opacity-80'
        }`}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: 14,
            height: 14,
            backgroundColor: isActive ? config.color : 'transparent',
            border: `1.5px solid ${config.color}`,
          }}
        >
          <Icon size={8} weight="fill" color={isActive ? '#fff' : config.color} />
        </div>
        <span className="text-[11px] text-[var(--text-primary)] leading-none whitespace-nowrap">
          {config.name}
        </span>
        <span className="text-[10px] text-[var(--text-secondary)] ml-auto tabular-nums">
          {typeCounts[typeId]}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* ── Cluster Markers ── */}
      {visibleClusters.map((cluster) => {
        const visTypes = cluster.types;
        const health = getZoneHealth(cluster.zoneId);
        const isSingle = visTypes.length === 1;

        if (isSingle) {
          // Single type — 26px dot
          const config = COMMODITY_TYPES[visTypes[0]];
          const Icon = ICON_MAP[config.icon] ?? Grains;

          return (
            <Marker
              key={cluster.zoneId}
              longitude={cluster.lng}
              latitude={cluster.lat}
              anchor="center"
            >
              <div
                className="flex flex-col items-center gap-[2px] cursor-pointer transition-transform hover:scale-125"
                onMouseEnter={() => onTooltipChange?.(buildTooltipData(cluster, visTypes[0]))}
                onMouseLeave={() => onTooltipChange?.(null)}
                onClick={(e) => { e.stopPropagation(); onTooltipLock?.(buildTooltipData(cluster, visTypes[0])); }}
              >
                <div
                  className="flex items-center justify-center rounded-full shadow-lg"
                  style={{
                    width: 26,
                    height: 26,
                    backgroundColor: config.color,
                    border: '2px solid rgba(255,255,255,0.8)',
                  }}
                >
                  <Icon size={14} weight="fill" color="#fff" />
                </div>
                {health !== null && (
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ width: 22, height: 3, backgroundColor: 'rgba(0,0,0,0.4)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${health * 100}%`, backgroundColor: healthColor(health) }}
                    />
                  </div>
                )}
              </div>
            </Marker>
          );
        }

        // Multiple types — horizontal row of dots
        const dotSize = 18;
        const dotGap = 3;

        return (
          <Marker
            key={cluster.zoneId}
            longitude={cluster.lng}
            latitude={cluster.lat}
            anchor="center"
          >
            <div
              className="flex flex-col items-center gap-[2px] cursor-pointer transition-transform hover:scale-110"
              onMouseEnter={() => onTooltipChange?.(buildTooltipData(cluster))}
              onMouseLeave={() => onTooltipChange?.(null)}
              onClick={(e) => { e.stopPropagation(); onTooltipLock?.(buildTooltipData(cluster)); }}
            >
              <div className="flex items-center" style={{ gap: dotGap }}>
                {visTypes.map((typeId) => {
                  const config = COMMODITY_TYPES[typeId];
                  const Icon = ICON_MAP[config.icon] ?? Grains;
                  return (
                    <div
                      key={typeId}
                      className="flex items-center justify-center rounded-full shadow-lg"
                      style={{
                        width: dotSize,
                        height: dotSize,
                        backgroundColor: config.color,
                        border: '1.5px solid rgba(255,255,255,0.7)',
                      }}
                    >
                      <Icon size={10} weight="fill" color="#fff" />
                    </div>
                  );
                })}
              </div>
              {health !== null && (
                <div
                  className="rounded-full overflow-hidden"
                  style={{
                    width: visTypes.length * dotSize + (visTypes.length - 1) * dotGap - 4,
                    height: 3,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${health * 100}%`, backgroundColor: healthColor(health) }}
                  />
                </div>
              )}
            </div>
          </Marker>
        );
      })}

      {/* ── Externality Flow Arcs ── */}
      {showFlows && arcGeoJSON && arcGeoJSON.features.length > 0 && (
        <Source id="externality-flows" type="geojson" data={arcGeoJSON}>
          {/* Benefit arcs — green dashed */}
          <Layer
            id="flow-arcs-benefit"
            type="line"
            filter={['==', ['get', 'flowType'], 'benefit']}
            paint={{
              'line-color': '#2ECC71',
              'line-width': [
                'interpolate', ['linear'], ['get', 'magnitude'],
                0, 1,
                200000, 4,
              ],
              'line-opacity': 0.7,
              'line-dasharray': [4, 3],
            }}
          />
          {/* Damage arcs — red dashed */}
          <Layer
            id="flow-arcs-damage"
            type="line"
            filter={['==', ['get', 'flowType'], 'damage']}
            paint={{
              'line-color': '#E74C3C',
              'line-width': [
                'interpolate', ['linear'], ['get', 'magnitude'],
                0, 1,
                200000, 4,
              ],
              'line-opacity': 0.7,
              'line-dasharray': [4, 3],
            }}
          />
        </Source>
      )}

      {/* ── Layers panel (bottom-left) ── */}
      <div className="absolute bottom-3 left-3 glass rounded-lg shadow-xl max-w-[200px]">
        {/* Zone types — collapsible */}
        <button
          onClick={() => setZonesOpen((v) => !v)}
          className="flex items-center gap-1.5 w-full px-3 pt-2 pb-1 text-left"
        >
          {effectiveZonesOpen
            ? <CaretDown size={11} weight="bold" className="text-[var(--text-secondary)]" />
            : <CaretRight size={11} weight="bold" className="text-[var(--text-secondary)]" />}
          <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
            Land &amp; Sea Use
          </span>
        </button>
        {effectiveZonesOpen && (
          <div className="flex flex-wrap gap-x-2.5 gap-y-1 px-3 pb-2">
            {ZONE_LEGEND.map(([name, color]) => (
              <div key={name} className="flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] text-[var(--text-primary)] capitalize leading-none whitespace-nowrap">
                  {name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Commodity toggles — collapsible */}
        <div className="border-t border-[var(--border)]">
          <button
            onClick={() => setCommoditiesOpen((v) => !v)}
            className="flex items-center gap-1.5 w-full px-3 pt-1.5 pb-1 text-left"
          >
            {effectiveCommoditiesOpen
              ? <CaretDown size={11} weight="bold" className="text-[var(--text-secondary)]" />
              : <CaretRight size={11} weight="bold" className="text-[var(--text-secondary)]" />}
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
              Commodities
            </span>
          </button>
          {effectiveCommoditiesOpen && (
            <div className="flex flex-col gap-0.5 px-2 pb-2">
              {COMMODITY_IDS.map(renderToggle)}
            </div>
          )}
        </div>

        {/* Ecosystem Services toggles — collapsible */}
        <div className="border-t border-[var(--border)]">
          <button
            onClick={() => setEsOpen((v) => !v)}
            className="flex items-center gap-1.5 w-full px-3 pt-1.5 pb-1 text-left"
          >
            {effectiveEsOpen
              ? <CaretDown size={11} weight="bold" className="text-[var(--text-secondary)]" />
              : <CaretRight size={11} weight="bold" className="text-[var(--text-secondary)]" />}
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
              Ecosystem Services
            </span>
          </button>
          {effectiveEsOpen && (
            <div className="flex flex-col gap-0.5 px-2 pb-2">
              {ES_IDS.map(renderToggle)}
            </div>
          )}
        </div>

        {/* Externality Flows toggle — only visible when simulation has flows */}
        {externalityFlows.length > 0 && (
          <div className="border-t border-[var(--border)]">
            <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showFlows}
                onChange={(e) => setShowFlows(e.target.checked)}
                className="accent-[var(--governance-green)] w-3 h-3"
              />
              <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                Externality Flows
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] ml-auto tabular-nums">
                {externalityFlows.length}
              </span>
            </label>
          </div>
        )}
      </div>
    </>
  );
}

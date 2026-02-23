import { useState, useCallback, useMemo } from 'react';
import Map, { Source, Layer, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import type { FillLayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import type { Territory } from '../types';
import camargueData from '../data/camargue.json';

const ZONE_COLORS: Record<string, string> = {
  lagoon: '#1a5276',
  rice_paddy: '#f0e68c',
  salt_pond: '#ff6b6b',
  wetland: '#4ecdc4',
  forest: '#2d5a27',
  urban: '#95a5a6',
  sansouire: '#c39b6a',
  pasture: '#7dcea0',
  beach: '#f5e6cc',
  coastal: '#f5e6cc',
  agriculture: '#f0e68c',
  salt_production: '#ff6b6b',
  grassland: '#7dcea0',
  protected: '#4ecdc4',
};

const zoneFillLayer: FillLayerSpecification = {
  id: 'zone-fill',
  type: 'fill',
  source: 'camargue',
  paint: {
    'fill-color': [
      'match',
      ['get', 'zone'],
      'lagoon', ZONE_COLORS.lagoon,
      'rice_paddy', ZONE_COLORS.rice_paddy,
      'salt_pond', ZONE_COLORS.salt_pond,
      'wetland', ZONE_COLORS.wetland,
      'forest', ZONE_COLORS.forest,
      'urban', ZONE_COLORS.urban,
      'sansouire', ZONE_COLORS.sansouire,
      'pasture', ZONE_COLORS.pasture,
      'beach', ZONE_COLORS.beach,
      '#cccccc',
    ],
    'fill-opacity': 0.7,
  },
};

const zoneOutlineLayer: LineLayerSpecification = {
  id: 'zone-outline',
  type: 'line',
  source: 'camargue',
  paint: {
    'line-color': '#2D3F52',
    'line-width': 1.5,
  },
};

const zoneHighlightLayer: FillLayerSpecification = {
  id: 'zone-highlight',
  type: 'fill',
  source: 'camargue',
  paint: {
    'fill-color': '#ffffff',
    'fill-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      0.2,
      0,
    ],
  },
};

/** Overlay that tints zones red/green based on resource health */
const healthOverlayLayer: FillLayerSpecification = {
  id: 'zone-health-overlay',
  type: 'fill',
  source: 'camargue-health',
  paint: {
    'fill-color': ['get', 'healthColor'],
    'fill-opacity': ['get', 'healthOpacity'],
  },
};

interface HoveredZone {
  id: string;
  name: string;
  zone: string;
  area_ha: number;
  description: string;
  resourceLevel?: number;
  maxCapacity?: number;
  harvestPressure?: number;
  steward?: string;
}

interface Props {
  territory?: Territory;
}

export function TerritoryMap({ territory }: Props) {
  const [hoveredZone, setHoveredZone] = useState<HoveredZone | null>(null);

  // Build a health overlay GeoJSON from territory state
  const healthGeoJSON = useMemo(() => {
    if (!territory) return null;

    const features = territory.zones.map((zone) => {
      const health = zone.maxCapacity > 0 ? zone.resourceLevel / zone.maxCapacity : 0;
      // Green for healthy, red for depleted
      const healthColor = health > 0.6 ? '#2ECC71' : health > 0.3 ? '#F39C12' : '#E74C3C';
      const healthOpacity = Math.min(0.4, (1 - health) * 0.5 + 0.05);

      return {
        type: 'Feature' as const,
        geometry: zone.geometry,
        properties: {
          id: zone.id,
          healthColor,
          healthOpacity,
        },
      };
    });

    return { type: 'FeatureCollection' as const, features };
  }, [territory]);

  const onMouseMove = useCallback((event: MapLayerMouseEvent) => {
    if (event.features && event.features.length > 0) {
      const feature = event.features[0];
      const zoneId = feature.properties?.id ?? '';

      // Enrich with simulation data if available
      const simZone = territory?.zones.find((z) => z.id === zoneId);

      setHoveredZone({
        id: zoneId,
        name: feature.properties?.name ?? '',
        zone: feature.properties?.zone ?? '',
        area_ha: feature.properties?.area_ha ?? 0,
        description: feature.properties?.description ?? '',
        resourceLevel: simZone?.resourceLevel,
        maxCapacity: simZone?.maxCapacity,
        harvestPressure: simZone?.harvestPressure,
        steward: simZone?.steward,
      });
    } else {
      setHoveredZone(null);
    }
  }, [territory]);

  const onMouseLeave = useCallback(() => {
    setHoveredZone(null);
  }, []);

  return (
    <div className="relative w-full h-full">
      <Map
        initialViewState={{
          longitude: 4.60,
          latitude: 43.48,
          zoom: 10.5,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://tiles.openfreemap.org/styles/positron"
        interactiveLayerIds={['zone-fill']}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <Source id="camargue" type="geojson" data={camargueData as GeoJSON.FeatureCollection}>
          <Layer {...zoneFillLayer} />
          <Layer {...zoneOutlineLayer} />
          <Layer {...zoneHighlightLayer} />
        </Source>

        {healthGeoJSON && (
          <Source id="camargue-health" type="geojson" data={healthGeoJSON}>
            <Layer {...healthOverlayLayer} />
          </Source>
        )}
      </Map>

      {/* Zone info tooltip */}
      {hoveredZone && (
        <div className="absolute bottom-4 left-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 max-w-xs shadow-lg">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {hoveredZone.name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: ZONE_COLORS[hoveredZone.zone] ?? '#ccc' }}
            />
            <span className="text-xs text-[var(--text-secondary)] capitalize">
              {hoveredZone.zone.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {hoveredZone.area_ha.toLocaleString()} ha
            </span>
          </div>
          {hoveredZone.resourceLevel !== undefined && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Resources</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {hoveredZone.resourceLevel.toFixed(0)} / {hoveredZone.maxCapacity?.toFixed(0)}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--bg-base)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${hoveredZone.maxCapacity ? (hoveredZone.resourceLevel / hoveredZone.maxCapacity) * 100 : 0}%`,
                    backgroundColor:
                      hoveredZone.maxCapacity && hoveredZone.resourceLevel / hoveredZone.maxCapacity > 0.6
                        ? 'var(--governance-green)'
                        : hoveredZone.resourceLevel / (hoveredZone.maxCapacity ?? 1) > 0.3
                          ? 'var(--warning-amber)'
                          : 'var(--danger-red)',
                  }}
                />
              </div>
              {hoveredZone.harvestPressure !== undefined && hoveredZone.harvestPressure > 0 && (
                <div className="text-[10px] text-[var(--danger-red)]">
                  Harvest pressure: {hoveredZone.harvestPressure.toFixed(1)}
                </div>
              )}
              {hoveredZone.steward && hoveredZone.steward !== 'commons' && (
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Steward: {hoveredZone.steward.slice(0, 8)}...
                </div>
              )}
            </div>
          )}
          {!hoveredZone.resourceLevel && (
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              {hoveredZone.description}
            </div>
          )}
        </div>
      )}

      {/* Territory health summary (when simulation is running) */}
      {territory && (
        <div className="absolute top-4 left-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 shadow-lg">
          <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
            Territory
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-secondary)]">Total Resources</span>
              <span className="font-mono text-[var(--text-primary)]">{territory.totalResources.toFixed(0)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-secondary)]">Biodiversity</span>
              <span className="font-mono text-[var(--text-primary)]">{territory.biodiversityIndex.toFixed(0)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-secondary)]">Sustainability</span>
              <span className="font-mono text-[var(--text-primary)]">{territory.sustainabilityScore.toFixed(0)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-secondary)]">Gini (inequality)</span>
              <span className="font-mono text-[var(--text-primary)]">{territory.giniCoefficient.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Map legend */}
      <div className="absolute top-4 right-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 shadow-lg">
        <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
          Land Use
        </div>
        {Object.entries(ZONE_COLORS).slice(0, 9).map(([name, color]) => (
          <div key={name} className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-[var(--text-primary)] capitalize">
              {name.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

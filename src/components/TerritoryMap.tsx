import { useState, useCallback, useMemo, useRef } from 'react';
import Map, { Source, Layer, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import type { FillLayerSpecification, LineLayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Territory, ZoneEconomics, AgentState } from '../types';
import camargueData from '../data/camargue.json';
import {
  CurrencyEur,
  Leaf,
  TrendDown,
  TrendUp,
  ShieldCheck,
  MapTrifold,
  Globe,
} from '@phosphor-icons/react';
import { CommodityMarkers, type CommodityTooltipData } from './CommodityMarkers';

const ZONE_COLORS: Record<string, string> = {
  lagoon: '#3A8FBF',
  rice_paddy: '#f0e68c',
  salt_pond: '#ff6b6b',
  wetland: '#4ecdc4',
  forest: '#5AAE54',
  urban: '#B0BEC5',
  sansouire: '#D4A96A',
  pasture: '#7dcea0',
  beach: '#f5e6cc',
  coastal: '#f5e6cc',
  agriculture: '#f0e68c',
  salt_production: '#ff6b6b',
  grassland: '#7dcea0',
  protected: '#4ecdc4',
  nearshore: '#2A7FAF',
  estuary: '#5BA8C0',
};


const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'esri-satellite',
      type: 'raster',
      source: 'esri-satellite',
    },
  ],
};

/** Approximate boundary of the Parc naturel marin du Golfe du Lion (eastern section visible in map) */
const MARINE_PARK_BOUNDARY: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { name: 'Parc naturel marin du Golfe du Lion' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [4.05, 43.46],
        [4.25, 43.44],
        [4.45, 43.42],
        [4.65, 43.38],
        [4.80, 43.39],
        [4.95, 43.37],
        [4.95, 43.22],
        [4.75, 43.24],
        [4.55, 43.28],
        [4.35, 43.32],
        [4.15, 43.36],
        [4.05, 43.38],
        [4.05, 43.46],
      ]],
    },
  }],
};

/** Label points for marine zones — placed at approximate visual centroids */
const MARINE_LABELS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Herbier de Posidonie Ouest', subtitle: 'Posidonia oceanica' },
      geometry: { type: 'Point', coordinates: [4.42, 43.39] },
    },
    {
      type: 'Feature',
      properties: { name: 'Estuaire du Grand Rhône', subtitle: 'Zone de mélange' },
      geometry: { type: 'Point', coordinates: [4.845, 43.35] },
    },
  ],
};

type MapStyleId = 'dark' | 'satellite';

const MARINE_FILTER: FillLayerSpecification['filter'] = ['in', ['get', 'zone'], ['literal', ['nearshore', 'estuary']]];
const LAND_FILTER: FillLayerSpecification['filter'] = ['!', ['in', ['get', 'zone'], ['literal', ['nearshore', 'estuary']]]];

const ZONE_FILL_COLOR: FillLayerSpecification['paint'] = {
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
    'nearshore', ZONE_COLORS.nearshore,
    'estuary', ZONE_COLORS.estuary,
    '#cccccc',
  ],
};

/** Marine zone fills — rendered first (below land) */
const marineFillLayer: FillLayerSpecification = {
  id: 'zone-fill-marine',
  type: 'fill',
  source: 'camargue',
  filter: MARINE_FILTER,
  paint: { ...ZONE_FILL_COLOR, 'fill-opacity': 0.25 },
};

/** Land zone fills — rendered on top of marine */
const landFillLayer: FillLayerSpecification = {
  id: 'zone-fill-land',
  type: 'fill',
  source: 'camargue',
  filter: LAND_FILTER,
  paint: { ...ZONE_FILL_COLOR, 'fill-opacity': 0.85 },
};

/** Thin white stroke for land zones only */
const zoneOutlineLayer: LineLayerSpecification = {
  id: 'zone-outline',
  type: 'line',
  source: 'camargue',
  filter: ['!', ['in', ['get', 'zone'], ['literal', ['nearshore', 'estuary']]]],
  paint: {
    'line-color': '#ffffff',
    'line-width': 0.5,
  },
};

/** Dashed outline for marine zones */
const marineOutlineLayer: LineLayerSpecification = {
  id: 'marine-outline',
  type: 'line',
  source: 'camargue',
  filter: ['in', ['get', 'zone'], ['literal', ['nearshore', 'estuary']]],
  paint: {
    'line-color': '#5BA8C0',
    'line-width': 1,
    'line-dasharray': [3, 2],
    'line-opacity': 0.7,
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
  economics?: ZoneEconomics;
}

interface Props {
  territory?: Territory;
  agents?: AgentState[];
}

export function TerritoryMap({ territory, agents }: Props) {
  const [hoveredZone, setHoveredZone] = useState<HoveredZone | null>(null);
  const [commodityTooltip, setCommodityTooltip] = useState<CommodityTooltipData | null>(null);
  const [isTooltipLocked, setIsTooltipLocked] = useState(false);
  const [mapStyleId, setMapStyleId] = useState<MapStyleId>('dark');
  const [labelLayerId, setLabelLayerId] = useState<string | undefined>();
  const mapRef = useRef<MapRef>(null);

  const isSatellite = mapStyleId === 'satellite';

  /** Find the first symbol (label) layer in the basemap so we can render zones below it */
  const detectLabelLayer = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    try {
      const layers = map.getStyle()?.layers;
      if (!layers) return;
      const firstSymbol = layers.find((l) => l.type === 'symbol');
      setLabelLayerId(firstSymbol?.id);
    } catch { /* style not loaded yet */ }
  }, []);

  const beforeId = !isSatellite ? labelLayerId : undefined;

  const healthGeoJSON = useMemo(() => {
    if (!territory) return null;
    const features = territory.zones.map((zone) => {
      const health = zone.maxCapacity > 0 ? zone.resourceLevel / zone.maxCapacity : 0;
      const healthColor = health > 0.6 ? '#2ECC71' : health > 0.3 ? '#F39C12' : '#E74C3C';
      const healthOpacity = Math.min(0.4, (1 - health) * 0.5 + 0.05);
      return {
        type: 'Feature' as const,
        geometry: zone.geometry,
        properties: { id: zone.id, healthColor, healthOpacity },
      };
    });
    return { type: 'FeatureCollection' as const, features };
  }, [territory]);

  /** Ref tracks what is currently pinned — avoids stale closures in onMouseMove */
  const pinnedRef = useRef<{ type: 'zone'; id: string } | { type: 'commodity' } | null>(null);

  /** Build a HoveredZone from a map feature */
  const buildZoneData = useCallback((feature: GeoJSON.Feature): HoveredZone => {
    const zoneId = feature.properties?.id ?? '';
    const simZone = territory?.zones.find((z) => z.id === zoneId);
    return {
      id: zoneId,
      name: feature.properties?.name ?? '',
      zone: feature.properties?.zone ?? '',
      area_ha: feature.properties?.area_ha ?? 0,
      description: feature.properties?.description ?? '',
      resourceLevel: simZone?.resourceLevel,
      maxCapacity: simZone?.maxCapacity,
      harvestPressure: simZone?.harvestPressure,
      steward: simZone?.steward,
      economics: simZone?.economics,
    };
  }, [territory]);

  const onMouseMove = useCallback((event: MapLayerMouseEvent) => {
    // When pinned, hover never changes anything — only clicks dismiss
    if (pinnedRef.current) return;

    if (event.features && event.features.length > 0) {
      setCommodityTooltip(null);
      setHoveredZone(buildZoneData(event.features[0] as unknown as GeoJSON.Feature));
    } else {
      setHoveredZone(null);
    }
  }, [buildZoneData]);

  /** Clicking a zone shape pins the tooltip; clicking empty space dismisses */
  const onMapClick = useCallback((event: MapLayerMouseEvent) => {
    if (event.features && event.features.length > 0) {
      const zoneId = event.features[0].properties?.id ?? '';
      pinnedRef.current = { type: 'zone', id: zoneId };
      setCommodityTooltip(null);
      setHoveredZone(buildZoneData(event.features[0] as unknown as GeoJSON.Feature));
      setIsTooltipLocked(true);
    } else {
      // Click on empty space — dismiss pin
      pinnedRef.current = null;
      setIsTooltipLocked(false);
      setHoveredZone(null);
      setCommodityTooltip(null);
    }
  }, [buildZoneData]);

  const onMouseLeave = useCallback(() => {
    if (!pinnedRef.current) {
      setHoveredZone(null);
    }
  }, []);

  /** Called by CommodityMarkers on marker hover */
  const onMarkerHover = useCallback((data: CommodityTooltipData | null) => {
    // When pinned, hover never changes anything — only clicks dismiss
    if (pinnedRef.current) return;

    if (data) {
      setCommodityTooltip(data);
      setHoveredZone(null);
    } else {
      setCommodityTooltip(null);
    }
  }, []);

  /** Called by CommodityMarkers on marker click — pins tooltip */
  const onMarkerLock = useCallback((data: CommodityTooltipData) => {
    pinnedRef.current = { type: 'commodity' };
    setCommodityTooltip(data);
    setIsTooltipLocked(true);
    setHoveredZone(null);
  }, []);

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 4.49, latitude: 43.42, zoom: 8.7 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={isSatellite ? SATELLITE_STYLE : DARK_STYLE}
        attributionControl={false}
        interactiveLayerIds={['zone-fill-marine', 'zone-fill-land']}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onMapClick}
        onLoad={detectLabelLayer}
      >
        {/* Marine park boundary — lowest layer */}
        <Source id="marine-park" type="geojson" data={MARINE_PARK_BOUNDARY}>
          <Layer
            id="marine-park-outline"
            type="line"
            source="marine-park"
            beforeId={beforeId}
            paint={{
              'line-color': '#5BA8C0',
              'line-width': 0.8,
              'line-dasharray': [6, 4],
              'line-opacity': 0.35,
            }}
          />
        </Source>
        {/* Zone layers: marine fills first, then land fills on top */}
        <Source id="camargue" type="geojson" data={camargueData as GeoJSON.FeatureCollection}>
          <Layer
            {...marineFillLayer}
            beforeId={beforeId}
            paint={isSatellite
              ? { ...marineFillLayer.paint, 'fill-opacity': 0.12 }
              : marineFillLayer.paint}
          />
          <Layer
            {...marineOutlineLayer}
            beforeId={beforeId}
            paint={isSatellite
              ? { ...marineOutlineLayer.paint, 'line-width': 1.5, 'line-opacity': 0.9 }
              : marineOutlineLayer.paint}
          />
          <Layer
            {...landFillLayer}
            beforeId={beforeId}
            paint={isSatellite
              ? { ...landFillLayer.paint, 'fill-opacity': 0.4 }
              : landFillLayer.paint}
          />
          <Layer
            {...zoneOutlineLayer}
            beforeId={beforeId}
            paint={isSatellite
              ? { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 0.85 }
              : zoneOutlineLayer.paint}
          />
          <Layer {...zoneHighlightLayer} />
        </Source>
        {healthGeoJSON && (
          <Source id="camargue-health" type="geojson" data={healthGeoJSON}>
            <Layer {...healthOverlayLayer} />
          </Source>
        )}
        {/* Marine zone labels */}
        <Source id="marine-labels" type="geojson" data={MARINE_LABELS}>
          <Layer
            id="marine-label-text"
            type="symbol"
            source="marine-labels"
            layout={{
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Italic', 'Arial Unicode MS Regular'],
              'text-size': 11,
              'text-anchor': 'center',
              'text-max-width': 12,
              'text-letter-spacing': 0.05,
            }}
            paint={{
              'text-color': '#8EC8D8',
              'text-halo-color': 'rgba(0,0,0,0.7)',
              'text-halo-width': 1.5,
              'text-opacity': 0.85,
            }}
          />
        </Source>

        {/* ── Commodity markers ── */}
        <CommodityMarkers
          territory={territory}
          onTooltipChange={onMarkerHover}
          onTooltipLock={onMarkerLock}
          isTooltipActive={!!(hoveredZone || commodityTooltip)}
        />
      </Map>

      {/* ── Zone tooltip ── */}
      {hoveredZone && (
        <div className="absolute top-5 left-5 glass rounded-xl p-4 max-w-[320px] shadow-xl animate-fade-in">
          <div className="h-[3px] rounded-full -mx-1 mb-3"
               style={{ backgroundColor: ZONE_COLORS[hoveredZone.zone] ?? '#ccc' }} />
          <div className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
            {hoveredZone.name}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ backgroundColor: ZONE_COLORS[hoveredZone.zone] ?? '#ccc' }}
            />
            <span className="text-xs text-[var(--text-secondary)] capitalize">
              {hoveredZone.zone.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-[var(--text-secondary)] opacity-60">
              {hoveredZone.area_ha.toLocaleString()} ha
            </span>
          </div>

          {hoveredZone.resourceLevel !== undefined && (
            <div className="space-y-2.5 mt-2.5">
              {/* Health */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)]">Health</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {hoveredZone.maxCapacity ? Math.round((hoveredZone.resourceLevel / hoveredZone.maxCapacity) * 100) : 0}%
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
              </div>

              {/* Economics */}
              {hoveredZone.economics && (
                <div className="pt-2.5 border-t border-[var(--border)] space-y-1.5">
                  <CommodityBreakdown economics={hoveredZone.economics} />
                  <EcosystemBreakdown
                    total={hoveredZone.economics.totalEcosystemValue}
                    services={hoveredZone.economics.currentServices}
                  />
                </div>
              )}

              {((hoveredZone.harvestPressure ?? 0) > 0 || (hoveredZone.steward && hoveredZone.steward !== 'commons')) && (
                <div className="flex items-center gap-2 text-[12px] flex-wrap">
                  {(hoveredZone.harvestPressure ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-[var(--danger-red)]">
                      <TrendDown size={12} /> {hoveredZone.harvestPressure?.toFixed(1)} harvest
                    </span>
                  )}
                  {hoveredZone.steward && hoveredZone.steward !== 'commons' && (
                    <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                      <ShieldCheck size={12} /> {agents?.find((a) => a.id === hoveredZone.steward)?.name ?? hoveredZone.steward.slice(0, 8)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {!hoveredZone.resourceLevel && (
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2">
              {hoveredZone.description}
            </div>
          )}

          {isTooltipLocked && (
            <div className="text-xs text-[var(--text-secondary)] opacity-40 mt-2 text-center italic">
              Pinned — click elsewhere to dismiss
            </div>
          )}
        </div>
      )}


      {/* ── Commodity tooltip (from marker hover/click) ── */}
      {!hoveredZone && commodityTooltip && (
        <div className="absolute top-5 left-5 glass rounded-xl p-4 max-w-[320px] shadow-xl animate-fade-in">
          <div className="h-[3px] rounded-full -mx-1 mb-3"
               style={{ backgroundColor: ZONE_COLORS[commodityTooltip.zoneType] ?? '#ccc' }} />
          {/* Header: zone name + type + area */}
          <div className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
            {commodityTooltip.zoneName}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ backgroundColor: ZONE_COLORS[commodityTooltip.zoneType] ?? '#ccc' }}
            />
            <span className="text-xs text-[var(--text-secondary)] capitalize">
              {commodityTooltip.zoneType.replace(/_/g, ' ')}
            </span>
            {commodityTooltip.area_ha > 0 && (
              <span className="text-xs text-[var(--text-secondary)] opacity-60">
                {commodityTooltip.area_ha.toLocaleString()} ha
              </span>
            )}
          </div>

          {/* Health bar */}
          {commodityTooltip.health !== null && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">Health</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {(commodityTooltip.health * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 bg-[var(--bg-base)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${commodityTooltip.health * 100}%`,
                    backgroundColor:
                      commodityTooltip.health > 0.6 ? 'var(--governance-green)'
                      : commodityTooltip.health > 0.3 ? 'var(--warning-amber)'
                      : 'var(--danger-red)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Pressure, regeneration & steward */}
          {(commodityTooltip.harvestPressure > 0 || commodityTooltip.regenerationRate > 0 || (commodityTooltip.steward && commodityTooltip.steward !== 'commons')) && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {commodityTooltip.harvestPressure > 0 && (
                <span className="flex items-center gap-1 text-[12px] text-[var(--danger-red)]">
                  <TrendDown size={12} weight="bold" />
                  <span className="font-mono">{commodityTooltip.harvestPressure.toFixed(1)}</span>
                  <span className="opacity-70">harvest</span>
                </span>
              )}
              {commodityTooltip.regenerationRate > 0 && (
                <span className="flex items-center gap-1 text-[12px] text-[var(--governance-green)]">
                  <TrendUp size={12} weight="bold" />
                  <span className="font-mono">{commodityTooltip.regenerationRate.toFixed(1)}</span>
                  <span className="opacity-70">regen</span>
                </span>
              )}
              {commodityTooltip.steward && commodityTooltip.steward !== 'commons' && (
                <span className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
                  <ShieldCheck size={12} /> {agents?.find((a) => a.id === commodityTooltip.steward)?.name ?? commodityTooltip.steward.slice(0, 8)}
                </span>
              )}
            </div>
          )}

          {/* Each commodity */}
          <div className="space-y-2 mt-2.5 pt-2.5 border-t border-[var(--border)]">
            {commodityTooltip.commodities.map((c) => {
              // Get per-commodity metric value
              const metricValue = commodityTooltip.economics
                ? c.metric === 'totalCommodityValue'
                  ? commodityTooltip.economics.totalCommodityValue
                  : (commodityTooltip.economics.currentServices as unknown as Record<string, number>)[c.metric] ?? 0
                : null;

              return (
                <div key={c.typeId}>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{ width: 18, height: 18, backgroundColor: c.color }}
                    >
                      <span className="text-white text-xs font-bold">{c.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">{c.name}</span>
                        {metricValue != null && metricValue > 0 && (
                          <span className="text-[12px] font-mono" style={{ color: c.color }}>
                            {formatEURCompact(metricValue)}/yr
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-0.5 text-[12px] text-[var(--text-secondary)] ml-[26px]">
                    <div><span className="font-semibold opacity-50">R</span> {c.rea.resource}</div>
                    <div><span className="font-semibold opacity-50">E</span> {c.rea.event}</div>
                    <div><span className="font-semibold opacity-50">A</span> {c.rea.agent}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Economics totals + top services */}
          {commodityTooltip.economics && (
            <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] space-y-1.5">
              <CommodityBreakdown economics={commodityTooltip.economics} />
              <EcosystemBreakdown
                total={commodityTooltip.economics.totalEcosystemValue}
                services={commodityTooltip.economics.currentServices}
              />
            </div>
          )}

          {/* Lock indicator */}
          {isTooltipLocked && (
            <div className="text-xs text-[var(--text-secondary)] opacity-40 mt-2 text-center italic">
              Pinned — click elsewhere to dismiss
            </div>
          )}
        </div>
      )}

      {/* ── Bioregion badge ── */}
      {!hoveredZone && !commodityTooltip && (
        <div className="absolute top-3 left-3 glass rounded-lg px-3 py-2 shadow-xl">
          <div className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">
            Camargue, Delta du Rhône
          </div>
          <div className="text-xs text-[var(--text-secondary)] leading-tight mt-0.5">
            Ecoregion: NE Spain &amp; S France Med. Forests <span className="opacity-50">PA1215</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] leading-tight">
            Bioregion: Balearic Sea &amp; W Med. Mixed Forests <span className="opacity-50">PA20</span>
          </div>
        </div>
      )}

      {/* ── Style toggle ── */}
      <div className="absolute top-3 right-3 flex glass rounded-lg overflow-hidden shadow-xl">
        <button
          onClick={() => setMapStyleId('dark')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
            !isSatellite
              ? 'bg-[var(--commons-teal)]/20 text-[var(--commons-teal)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <MapTrifold size={12} weight={isSatellite ? 'regular' : 'fill'} />
          Dark
        </button>
        <button
          onClick={() => setMapStyleId('satellite')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
            isSatellite
              ? 'bg-[var(--commons-teal)]/20 text-[var(--commons-teal)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Globe size={12} weight={isSatellite ? 'fill' : 'regular'} />
          Satellite
        </button>
      </div>

    </div>
  );
}

/** Commodity total + name/per-ha breakdown */
function CommodityBreakdown({ economics }: { economics: ZoneEconomics }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <CurrencyEur size={12} weight="bold" className="text-[var(--stake-gold)]" />
          Commodity
        </div>
        <span className="text-xs font-mono text-[var(--stake-gold)]">
          {formatEURCompact(economics.totalCommodityValue)}/yr
        </span>
      </div>
      {economics.totalCommodityValue > 0 && (
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0 mt-1 ml-[18px]">
          <span className="text-xs text-[var(--text-secondary)] opacity-60">{economics.commodityType}</span>
          <span className="text-xs text-[var(--text-secondary)] opacity-60 font-mono tabular-nums text-left">
            €{economics.commodityValuePerHa.toLocaleString()}/ha
          </span>
        </div>
      )}
    </div>
  );
}

/** Ecosystem total + individual service breakdown at lower visual weight */
function EcosystemBreakdown({ total, services }: { total: number; services: import('../types').EcosystemServices }) {
  const entries: [string, number][] = [
    ['Carbon', services.carbonSequestration],
    ['Water', services.waterPurification],
    ['Flood ctrl', services.floodRegulation],
    ['Biodiversity', services.biodiversityHabitat],
    ['Fish nursery', services.fishNursery],
    ['Recreation', services.recreationCultural],
  ];
  const active = entries.filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      {/* Total — same weight as Commodity line */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <Leaf size={12} weight="bold" className="text-[var(--governance-green)]" />
          Ecosystem
        </div>
        <span className="text-xs font-mono text-[var(--governance-green)]">
          {formatEURCompact(total)}/yr
        </span>
      </div>
      {/* Individual services — one per line, EUR values left-aligned in second column */}
      {active.length > 0 && (
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0 mt-1 ml-[18px]">
          {active.map(([name, val]) => (
            <div key={name} className="contents">
              <span className="text-xs text-[var(--text-secondary)] opacity-60">{name}</span>
              <span className="text-xs text-[var(--text-secondary)] opacity-60 font-mono tabular-nums text-left">
                {formatEURCompact(val)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatEURCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

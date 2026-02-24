/**
 * Commodity Types + Ecosystem Services — Zone-economics markers for the Camargue
 *
 * 7 commodity categories covering 32 of 33 GeoJSON zones (urban excluded).
 * 3 ecosystem service types covering key ecological zones.
 *
 * REA triples (Resource-Event-Agent) describe the actor-network for each type:
 *   Resource = the economic object
 *   Event = the transformative process
 *   Agent = the custodian/producer
 */

export type CommodityTypeId =
  | 'rice' | 'salt' | 'reed' | 'fishery' | 'timber' | 'tourism' | 'livestock'
  | 'water' | 'carbon' | 'biodiversity';

export type MarkerCategory = 'commodity' | 'ecosystem_service';

export interface CommodityType {
  name: string;
  color: string;
  /** Phosphor icon name */
  icon: string;
  category: MarkerCategory;
  /** Which camargue.json zone types produce this commodity/service */
  sourceZones: string[];
  /** REA accounting triple */
  rea: {
    resource: string;
    event: string;
    agent: string;
  };
  /** Key metric displayed in marker popup */
  metric: string;
}

export const COMMODITY_TYPES: Record<CommodityTypeId, CommodityType> = {
  // ── Commodities ──
  rice: {
    name: 'Rice',
    color: '#8BC34A',
    icon: 'Grains',
    category: 'commodity',
    sourceZones: ['rice_paddy'],
    rea: {
      resource: 'Camargue IGP rice (tonnes/yr)',
      event: 'Irrigated paddy cultivation (Apr\u2013Oct)',
      agent: 'SRFF / 160 rice farms',
    },
    metric: 'totalCommodityValue',
  },
  salt: {
    name: 'Salt',
    color: '#C4A35A',
    icon: 'Diamond',
    category: 'commodity',
    sourceZones: ['salt_pond'],
    rea: {
      resource: 'Sea salt / Fleur de Sel (tonnes/yr)',
      event: 'Solar evaporation in crystallization ponds',
      agent: 'Salins Group (22,000 ha)',
    },
    metric: 'totalCommodityValue',
  },
  reed: {
    name: 'Reed',
    color: '#26A69A',
    icon: 'Plant',
    category: 'commodity',
    sourceZones: ['wetland', 'sansouire'],
    rea: {
      resource: 'Sagne reed bundles (tonnes/yr)',
      event: 'Winter harvest of Phragmites australis',
      agent: 'Sagneurs / Thatching cooperatives',
    },
    metric: 'totalCommodityValue',
  },
  fishery: {
    name: 'Fishery',
    color: '#42A5F5',
    icon: 'Fish',
    category: 'commodity',
    sourceZones: ['lagoon', 'nearshore', 'estuary'],
    rea: {
      resource: 'Eel, mullet, sea bream (tonnes/yr)',
      event: 'Artisanal net & capechade fishing',
      agent: 'Prud\u2019homies de p\u00EAche / 80 fishers',
    },
    metric: 'totalCommodityValue',
  },
  timber: {
    name: 'Timber',
    color: '#5AAE54',
    icon: 'Tree',
    category: 'commodity',
    sourceZones: ['forest'],
    rea: {
      resource: 'Poplar & tamarisk wood (m\u00B3/yr)',
      event: 'Selective forestry & coppicing',
      agent: 'ONF / Communal forest managers',
    },
    metric: 'totalCommodityValue',
  },
  tourism: {
    name: 'Tourism',
    color: '#FFB74D',
    icon: 'SunHorizon',
    category: 'commodity',
    sourceZones: ['beach'],
    rea: {
      resource: 'Visitor-days & accommodation revenue',
      event: 'Seasonal coastal tourism (Jun\u2013Sep)',
      agent: 'OT Saintes-Maries / Camargue operators',
    },
    metric: 'totalCommodityValue',
  },
  livestock: {
    name: 'Livestock',
    color: '#7dcea0',
    icon: 'Horse',
    category: 'commodity',
    sourceZones: ['pasture'],
    rea: {
      resource: 'Camargue bulls & horses (head/yr)',
      event: 'Extensive grazing on saline pasture',
      agent: 'Manadiers / \u00C9leveurs (manades)',
    },
    metric: 'totalCommodityValue',
  },

  // ── Ecosystem Services ──
  water: {
    name: 'Water',
    color: '#1B4F72',
    icon: 'Drop',
    category: 'ecosystem_service',
    sourceZones: ['wetland', 'lagoon', 'estuary'],
    rea: {
      resource: 'Freshwater regulation (m\u00B3/yr)',
      event: 'Purification + flood buffering',
      agent: 'Agence de l\u2019Eau / SYMADREM',
    },
    metric: 'waterPurification',
  },
  carbon: {
    name: 'Carbon',
    color: '#2D5F2D',
    icon: 'Leaf',
    category: 'ecosystem_service',
    sourceZones: ['wetland', 'lagoon', 'forest', 'nearshore'],
    rea: {
      resource: 'Carbon credits (tCO\u2082e/yr)',
      event: 'Sequestration in biomass + sediment',
      agent: 'PNRC / Conservatoire du Littoral',
    },
    metric: 'carbonSequestration',
  },
  biodiversity: {
    name: 'Biodiversity',
    color: '#D946EF',
    icon: 'Bird',
    category: 'ecosystem_service',
    sourceZones: ['lagoon', 'nearshore', 'estuary', 'wetland'],
    rea: {
      resource: 'Biodiversity credits (ha-eq)',
      event: 'Habitat provisioning + nursery function',
      agent: 'Tour du Valat / SNPN / LPO PACA',
    },
    metric: 'biodiversityHabitat',
  },
};

export const COMMODITY_TYPE_IDS = Object.keys(COMMODITY_TYPES) as CommodityTypeId[];

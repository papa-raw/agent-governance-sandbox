import { z } from 'zod';

// ── Ecosystem Services Valuation ──

export type EcosystemServiceType =
  | 'carbonSequestration'
  | 'waterPurification'
  | 'floodRegulation'
  | 'biodiversityHabitat'
  | 'fishNursery'
  | 'recreationCultural';

export type GreenAssetClass =
  | 'carbon_credit'
  | 'biodiversity_credit'
  | 'water_quality_certificate'
  | 'ecosystem_service_payment';

export interface EcosystemServices {
  carbonSequestration: number;    // EUR/yr
  waterPurification: number;
  floodRegulation: number;
  biodiversityHabitat: number;
  fishNursery: number;
  recreationCultural: number;
}

export interface ZoneEconomics {
  commodityType: string;
  commodityValuePerHa: number;       // EUR/ha/yr
  totalCommodityValue: number;       // EUR/yr (scaled by health)
  servicesPerHa: EcosystemServices;  // EUR/ha/yr at full health
  currentServices: EcosystemServices; // EUR/yr scaled by health + neighbor bonus
  totalEcosystemValue: number;       // sum of currentServices
  totalValue: number;                // commodity + ecosystem
  healthFactor: number;              // 0-1 resourceLevel/maxCapacity
}

export type ValueFlowType =
  | 'extraction'
  | 'contribution'
  | 'externality'
  | 'regeneration';

export interface ValueFlow {
  id: string;
  round: number;
  type: ValueFlowType;
  agentId?: string;
  sourceZoneId: string;
  targetZoneId?: string;           // for externalities
  commodityEUR: number;
  ecosystemEUR: number;
  netEUR: number;                  // commodityEUR - ecosystemEUR (extraction destroys services)
  description: string;
}

export interface AgentAttribution {
  agentId: string;
  agentName: string;
  totalExtractedEUR: number;
  totalContributedEUR: number;
  totalExternalityEUR: number;     // negative = damage, positive = benefit
  netEcosystemImpactEUR: number;   // sum of all ecosystem effects
  netEconomicImpactEUR: number;    // overall net
}

export interface GreenAssetPotential {
  assetClass: GreenAssetClass;
  label: string;
  nativeUnit: string;              // tCO2e, ha-eq, m3-eq
  pricePerUnit: number;            // EUR
  totalUnitsAtFullHealth: number;
  currentUnits: number;
  lostUnits: number;
  totalEUR: number;
  currentEUR: number;
  lostEUR: number;
  sourceZoneIds: string[];
}

export interface TerritoryGreenAssets {
  assets: GreenAssetPotential[];
  totalAnnualPotentialEUR: number;
  preservedPotentialEUR: number;
  lostPotentialEUR: number;
}

// ── Territorial Zones (Camargue GeoJSON) ──

export type LandUseCategory =
  | 'agriculture'        // Rice paddies, irrigated farmland
  | 'salt_production'    // Salins du Midi, industrial salines
  | 'wetland'            // Marshes, natural wetlands
  | 'lagoon'             // Etang de Vaccares, water bodies
  | 'forest'             // Wooded areas
  | 'urban'              // Settlements, infrastructure
  | 'coastal'            // Dunes, beach, shoreline
  | 'grassland'          // Grazing land (manades)
  | 'protected'          // Natura 2000, reserves
  | 'nearshore'          // Posidonia seagrass, shallow marine
  | 'estuary';           // Rhône river mouth mixing zone

export interface TerritorialZone {
  id: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties: {
    code_occ: string;          // PNR land use code
    libelle: string;           // Human-readable label
    classe: string;            // Macro-category from GeoJSON
    surface_ha: number;
  };
  // Simulation state (layered on GeoJSON properties)
  category: LandUseCategory;
  resourceLevel: number;       // 0-100
  maxCapacity: number;
  steward: string | 'commons'; // agentId or shared
  harvestPressure: number;
  regenerationRate: number;    // modified by neighbor health
  adjacentZones: string[];     // computed from geometry adjacency
  economics?: ZoneEconomics;   // EUR-denominated ecosystem service valuation
}

export interface Territory {
  zones: TerritorialZone[];
  totalResources: number;
  biodiversityIndex: number;      // diversity of active landUse types
  giniCoefficient: number;        // resource inequality across agents
  sustainabilityScore: number;    // replenish rate vs. harvest rate
  waterBalance: number;           // freshwater/saltwater equilibrium
  // Ecosystem economics (computed from zone economics)
  totalCommodityValue?: number;       // EUR/yr across all zones
  totalEcosystemValue?: number;       // EUR/yr across all zones
  totalTerritorialCapital?: number;   // commodity + ecosystem EUR/yr
  valueFlows?: ValueFlow[];           // current round's value transfer records
  agentAttributions?: AgentAttribution[];
  greenAssets?: TerritoryGreenAssets;
}

// ── Commons & Resources ──

export interface CommonsState {
  resourcePool: number;
  maxCapacity: number;
  replenishRate: number;         // per-round regeneration
  territory: Territory;
}

// ── Agents ──

export type AgentPersonality =
  | 'cooperator'
  | 'free-rider'
  | 'strategic'
  | 'whale'
  | 'chaotic';

/** Camargue stakeholder roles — 12 archetypes representing 42+ real organizations */
export type CamargueStakeholder =
  | 'park_authority'       // PNRC coordination body → strategic
  | 'conservationist'      // Tour du Valat + SNPN + WWF + LPO PACA → cooperator
  | 'public_landowner'     // Conservatoire du Littoral + OFB (25,000 ha) → cooperator
  | 'rice_farmer'          // SRFF + CFR + 160 rice farms → whale
  | 'salt_producer'        // Salins Group (22,000 ha) → strategic
  | 'rancher'              // Confrérie des Gardians + ~150 manades → cooperator
  | 'fisher'               // Prud'homies de Pêche + aquaculture → strategic
  | 'hunter'               // FDC 13 + local ACCAs (16,500 members) → free-rider
  | 'tourism_developer'    // Tourism offices + private operators → chaotic
  | 'municipality'         // Arles + Saintes-Maries + Port-Saint-Louis → strategic
  | 'water_authority'      // Agence de l'Eau + SYMADREM + CEDE → cooperator
  | 'regional_government'; // Région PACA + Département BdR → strategic

export interface DelegationConfig {
  values: {
    environment: number;  // 0-1 priority weight
    equity: number;
    growth: number;
    stability: number;
  };
  redLines: string[];           // Natural language constraints
  authorityBounds: {
    maxConsume: number;         // Max resources to harvest per round
    canPropose: boolean;
    canVoteToExclude: boolean;
    maxStakeRatio: number;     // Max % of resources to stake
  };
}

export interface Sanction {
  round: number;
  type: 'warning' | 'penalty' | 'suspension' | 'exclusion';
  reason: string;
  amount?: number;              // resource penalty
  reputationCost?: number;
}

// ── UCAN / Agent Identity ──

export type AttackVector =
  | 'vote_spoof'
  | 'privilege_escalation'
  | 'ghost_write'
  | 'history_tamper';

export type AgentCapability =
  | 'vote'
  | 'propose'
  | 'consume'
  | 'contribute'
  | 'store'
  | 'enforce'
  | 'modify_rules';

export interface AgentIdentity {
  did: string;                  // did:key:z6Mk... (Ed25519-derived)
  publicKeyHex: string;
  capabilities: AgentCapability[];
  revoked: boolean;
  mintedAt: string;
}

export interface CapabilityViolation {
  attackVector: AttackVector;
  attemptedBy: string;          // agent DID
  attemptedAction: string;      // the rejected action type
  rejectionReason: string;
  agentId: string;
  agentName: string;
}

export interface AgentState {
  id: string;
  name: string;
  description: string;
  personality: AgentPersonality;
  stakeholder: CamargueStakeholder;
  resources: number;
  reputation: number;           // 0-100
  stake: number;                // resources locked in governance
  sanctions: Sanction[];
  sanctionLevel: number;        // current step on graduated ladder (0 = clean)
  contributionHistory: number[];
  consumptionHistory: number[];
  excluded: boolean;
  suspended: boolean;
  suspendedUntilRound?: number;
  delegationConfig: DelegationConfig;
  managedZones: string[];       // zone IDs this agent stewards
  identity?: AgentIdentity;
}

// ── Agent Actions ──

export interface RuleProposal {
  id: string;
  proposerId: string;
  description: string;
  mechanism: string;            // which mechanism to modify
  change: Record<string, unknown>;
  round: number;
}

export interface EncryptedBallot {
  ciphertext: string;
  dataToEncryptHash: string;
  accessControlConditions: unknown[];
}

export type AgentActionType =
  | 'consume'
  | 'contribute'
  | 'propose_rule'
  | 'vote'
  | 'abstain'
  | 'enforce'
  | 'modify_rules';

export interface AgentAction {
  agentId: string;
  type: AgentActionType;
  amount?: number;
  targetZones?: string[];       // which zones affected
  proposal?: RuleProposal;
  ballot?: EncryptedBallot;
  vote?: 'yes' | 'no';         // plaintext vote (encrypted later)
  reasoning: string;
  alignmentNote?: string;       // how this serves steward's values
}

// ── Governance ──

export type GovernanceConfigId =
  | 'tragedy'
  | 'ostrom'
  | 'cybernetic'
  | 'adaptive';

export interface BoundaryRules {
  enabled: boolean;
  maxAgents: number;
  requireRegistration: boolean;
  admissionMethod: 'open' | 'stake_required' | 'reputation_gate' | 'invite_only';
  admissionThreshold?: number;  // stake amount, rep score, or vote %
}

export interface ContributionRequirements {
  enabled: boolean;
  minContributionPercent: number; // % of harvested resources to return
  enforcementInterval: number;    // check every N rounds
  measurementWindow: number;      // rolling average over N rounds
  consequence: 'graduated_sanctions' | 'flat_penalty' | 'immediate_exclusion';
  flatPenaltyAmount?: number;
}

export interface GraduatedSanctions {
  enabled: boolean;
  levels: Array<{
    threshold: number;          // number of violations to reach this level
    action: 'warning' | 'penalty' | 'suspension' | 'exclusion';
    penaltyAmount?: number;
    reputationCost?: number;
    suspensionDuration?: number; // rounds
  }>;
  decayRounds: number;          // clean rounds to drop one level
  maxSanctionsPerRound: number;
}

export interface CollectiveChoice {
  enabled: boolean;
  whoCanPropose: 'any' | 'reputation_gate' | 'unsanctioned';
  proposalReputationThreshold?: number;
  votingMethod: 'simple_majority' | 'supermajority' | 'quadratic' | 'stake_weighted';
  supermajorityPercent?: number;
  quorumPercent: number;        // % of agents required to vote
  deliberationRounds: number;   // rounds for discussion before voting
  ballotPrivacy: 'public' | 'encrypted' | 'threshold_disclosure';
  disclosureThreshold?: number; // % majority to reveal individual votes
}

export interface ValidationStaking {
  enabled: boolean;
  minStake: number;
  stakeWeight: number;          // 0=equal votes, 0.5=sqrt, 1.0=linear
  slashOnSanction: boolean;
  slashPercent?: number;
}

export interface GovernanceConfig {
  id: GovernanceConfigId;
  name: string;
  description: string;
  boundaryRules: BoundaryRules;
  contributionRequirements: ContributionRequirements;
  graduatedSanctions: GraduatedSanctions;
  collectiveChoice: CollectiveChoice;
  validationStaking: ValidationStaking;
}

// ── Governance Events ──

export type GovernanceEventType =
  | 'sanction_applied'
  | 'proposal_created'
  | 'vote_cast'
  | 'vote_tallied'
  | 'rule_changed'
  | 'agent_excluded'
  | 'agent_registered'
  | 'agent_suspended'
  | 'enforcement_check'
  | 'stake_slashed'
  | 'boundary_sealed'
  | 'boundary_reopened'
  | 'capability_violation';

export interface GovernanceEvent {
  type: GovernanceEventType;
  round: number;
  details: Record<string, unknown>;
  timestamp: string;
}

// ── Failure Modes ──

export type FailureModeCategory = 'commons' | 'governance' | 'agent' | 'systemic';
export type FailureModeStatus = 'inactive' | 'warning' | 'triggered' | 'critical';

export interface FailureMode {
  id: string;
  name: string;
  description: string;
  category: FailureModeCategory;
  status: FailureModeStatus;
  severity: number;             // 0-1, continuous gauge
  triggerThreshold: number;     // severity at which status becomes 'triggered'
  roundTriggered?: number;
  evidence: string;
  cascadesTo: string[];         // failure mode IDs this can cause
}

// ── Ballot / Voting ──

export interface BallotSummary {
  proposalId: string;
  proposalDescription: string;
  totalVoters: number;
  votesCast: number;
  disclosureThreshold: number;   // 0-1
  thresholdMet: boolean;
  disclosed: boolean;
  results?: {
    yes: number;
    no: number;
    quorumMet: boolean;
    votes: Array<{ agentId: string; vote: 'yes' | 'no' }>;
  };
  /** Lit Protocol seal on disclosed results (null if Lit unavailable) */
  litSeal?: {
    ciphertext: string;
    dataToEncryptHash: string;
    accessControlConditions: unknown[];
    sealedAt: string;
    network: string;
  } | null;
}

// ── Rounds & Simulation ──

export interface RoundResult {
  round: number;
  actions: AgentAction[];
  governanceEvents: GovernanceEvent[];
  commonsLevel: number;
  territorySnapshot: {
    totalResources: number;
    biodiversityIndex: number;
    giniCoefficient: number;
    sustainabilityScore: number;
    waterBalance: number;
    totalCommodityValue?: number;
    totalEcosystemValue?: number;
    totalTerritorialCapital?: number;
    greenAssets?: TerritoryGreenAssets;
  };
  valueFlows?: ValueFlow[];
  agentAttributions?: AgentAttribution[];
  failureModes: FailureMode[];
  ballotSummary?: BallotSummary;  // threshold-disclosure voting result
  replicatorPrediction?: number;  // predicted cooperation rate
  actualCooperationRate?: number;
  cid?: string;                   // Storacha CID once persisted
}

export interface SimulationState {
  id: string;
  round: number;
  commons: CommonsState;
  agents: AgentState[];
  governance: GovernanceConfig;
  failureModes: FailureMode[];
  history: RoundResult[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'collapsed';
  stateCID?: string;
}

export interface SimulationSummary {
  simulationId: string;
  configId: GovernanceConfigId;
  totalRounds: number;
  finalCommonsLevel: number;
  peakCommonsLevel: number;
  agentSummaries: Array<{
    id: string;
    name: string;
    personality: AgentPersonality;
    stakeholder: CamargueStakeholder;
    finalResources: number;
    totalConsumed: number;
    totalContributed: number;
    sanctionsReceived: number;
    excluded: boolean;
  }>;
  failureModesSummary: Array<{
    id: string;
    name: string;
    peakSeverity: number;
    roundTriggered?: number;
    resolved: boolean;
  }>;
  governanceEventsCount: number;
  avgCooperationRate: number;
  replicatorAccuracy: number;   // how close prediction was to actual
  cid?: string;
}

// ── Zod Schemas (runtime validation for LLM agent output) ──

export const AgentActionSchema = z.object({
  agentId: z.string(),
  type: z.enum(['consume', 'contribute', 'propose_rule', 'vote', 'abstain', 'enforce', 'modify_rules']),
  amount: z.number().optional(),
  targetZones: z.array(z.string()).optional(),
  proposal: z
    .object({
      id: z.string(),
      proposerId: z.string(),
      description: z.string(),
      mechanism: z.string(),
      change: z.record(z.string(), z.unknown()),
      round: z.number(),
    })
    .optional(),
  vote: z.enum(['yes', 'no']).optional(),
  reasoning: z.string(),
  alignmentNote: z.string().optional(),
});

export const AgentDecisionResponseSchema = z.object({
  action: AgentActionSchema,
});

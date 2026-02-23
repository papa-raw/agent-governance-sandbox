import { z } from 'zod';

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
  | 'protected';         // Natura 2000, reserves

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
}

export interface Territory {
  zones: TerritorialZone[];
  totalResources: number;
  biodiversityIndex: number;      // diversity of active landUse types
  giniCoefficient: number;        // resource inequality across agents
  sustainabilityScore: number;    // replenish rate vs. harvest rate
  waterBalance: number;           // freshwater/saltwater equilibrium
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

/** Camargue stakeholder roles mapped to agent personalities */
export type CamargueStakeholder =
  | 'conservationist'    // Tour du Valat, PNR → cooperator
  | 'rice_farmer'        // Large rice operations → whale
  | 'salt_producer'      // Salins du Midi → strategic
  | 'hunter'             // Seasonal hunters → free-rider
  | 'tourism_developer'; // Tourism pressure → chaotic

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

export interface AgentState {
  id: string;
  name: string;
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
  | 'abstain';

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
  | 'plutocratic'
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
  | 'boundary_reopened';

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
  };
  failureModes: FailureMode[];
  replicatorPrediction?: number; // predicted cooperation rate
  actualCooperationRate?: number;
  cid?: string;                 // Storacha CID once persisted
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
  type: z.enum(['consume', 'contribute', 'propose_rule', 'vote', 'abstain']),
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

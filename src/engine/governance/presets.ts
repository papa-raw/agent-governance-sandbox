import type { GovernanceConfig } from '../../types';

/**
 * Governance configuration presets.
 * Each preset is a starting point — stewards can toggle individual mechanisms.
 */

export const TRAGEDY_CONFIG: GovernanceConfig = {
  id: 'tragedy',
  name: 'Tragedy of the Commons',
  description: 'No governance. Agents act purely in self-interest. Expected outcome: commons depletion in ~10-15 rounds.',
  boundaryRules: {
    enabled: false,
    maxAgents: 20,
    requireRegistration: false,
    admissionMethod: 'open',
  },
  contributionRequirements: {
    enabled: false,
    minContributionPercent: 0,
    enforcementInterval: 5,
    measurementWindow: 3,
    consequence: 'graduated_sanctions',
  },
  graduatedSanctions: {
    enabled: false,
    levels: [],
    decayRounds: 10,
    maxSanctionsPerRound: 0,
  },
  collectiveChoice: {
    enabled: false,
    whoCanPropose: 'any',
    votingMethod: 'simple_majority',
    quorumPercent: 50,
    deliberationRounds: 0,
    ballotPrivacy: 'public',
  },
  validationStaking: {
    enabled: false,
    minStake: 0,
    stakeWeight: 0,
    slashOnSanction: false,
  },
};

export const OSTROM_CONFIG: GovernanceConfig = {
  id: 'ostrom',
  name: 'Ostrom Commons Governance',
  description: 'Institutional governance based on Ostrom\'s 8 design principles. Boundary rules, contribution requirements, graduated sanctions, collective choice. Expected outcome: sustainable commons.',
  boundaryRules: {
    enabled: true,
    maxAgents: 15,
    requireRegistration: true,
    admissionMethod: 'open',
  },
  contributionRequirements: {
    enabled: true,
    minContributionPercent: 15,
    enforcementInterval: 5,
    measurementWindow: 3,
    consequence: 'graduated_sanctions',
  },
  graduatedSanctions: {
    enabled: true,
    levels: [
      { threshold: 1, action: 'warning', reputationCost: 0 },
      { threshold: 2, action: 'penalty', penaltyAmount: 20, reputationCost: 10 },
      { threshold: 3, action: 'suspension', reputationCost: 25, suspensionDuration: 3 },
      { threshold: 4, action: 'exclusion' },
    ],
    decayRounds: 10,
    maxSanctionsPerRound: 4,
  },
  collectiveChoice: {
    enabled: true,
    whoCanPropose: 'any',
    votingMethod: 'simple_majority',
    quorumPercent: 60,
    deliberationRounds: 2,
    ballotPrivacy: 'threshold_disclosure',
    disclosureThreshold: 66,
  },
  validationStaking: {
    enabled: false,
    minStake: 0,
    stakeWeight: 0,
    slashOnSanction: false,
  },
};

export const CYBERNETIC_CONFIG: GovernanceConfig = {
  id: 'cybernetic',
  name: 'Cybernetic DAO',
  description:
    'Crypto-institutional governance as a cybernetic feedback system (Zargham & Nabben 2024). ' +
    'Quadratic stake-weighted voting flattens whale capture. Stake-gated entry (money) + reputation-gated proposals (merit) ' +
    'resolve the membership tension. Algorithmic enforcement acts as an ecological oracle — the simulation\'s own metrics ' +
    'trigger graduated sanctions, slashing, and policy responses. Multistage deliberation (3 rounds) with threshold-disclosure ' +
    'ballots. Expected outcome: adaptive self-regulation where the governance surface tightens feedback loops between ' +
    'institutional decisions and ecosystem state.',
  boundaryRules: {
    enabled: true,
    maxAgents: 15,
    requireRegistration: true,
    admissionMethod: 'stake_required',  // Money: skin in the game to participate
    admissionThreshold: 30,             // Lower barrier than plutocratic — access matters
  },
  contributionRequirements: {
    enabled: true,
    minContributionPercent: 12,         // The oracle: algorithmic enforcement based on ecosystem state
    enforcementInterval: 3,             // Tighter feedback loop than Ostrom (every 3 rounds, not 5)
    measurementWindow: 3,
    consequence: 'graduated_sanctions',
  },
  graduatedSanctions: {
    enabled: true,
    levels: [
      { threshold: 1, action: 'warning', reputationCost: 5 },
      { threshold: 2, action: 'penalty', penaltyAmount: 25, reputationCost: 15 },
      { threshold: 3, action: 'suspension', reputationCost: 30, suspensionDuration: 2 },
      { threshold: 5, action: 'exclusion' },
    ],
    decayRounds: 6,                     // Faster reputation recovery — cybernetic systems forgive and adapt
    maxSanctionsPerRound: 5,
  },
  collectiveChoice: {
    enabled: true,
    whoCanPropose: 'reputation_gate',   // Merit: only proven contributors shape governance
    proposalReputationThreshold: 40,
    votingMethod: 'quadratic',          // sqrt(stake) = votes — long tail gets voice
    quorumPercent: 50,
    deliberationRounds: 3,              // Multistage: straw poll → deliberation → binding vote
    ballotPrivacy: 'threshold_disclosure',
    disclosureThreshold: 60,            // Reveal votes on clear majorities — reduces authority bias
  },
  validationStaking: {
    enabled: true,
    minStake: 30,
    stakeWeight: 0.5,                   // Quadratic: sqrt(stake) determines vote weight
    slashOnSanction: true,              // Slashing: governance violations destroy economic value
    slashPercent: 15,
  },
};

export const CAMARGUE_CONFIG: GovernanceConfig = {
  id: 'adaptive',
  name: 'Camargue Governance (Real-World)',
  description: 'Mirrors the actual institutional architecture of the Camargue delta: PNRC coordination, Natura 2000 boundary rules, COPIL collective choice (supermajority), DREAL-backed graduated sanctions, and EU Water Framework Directive compliance. The governance surface that has maintained this socio-ecological system since 1970.',
  boundaryRules: {
    enabled: true,
    maxAgents: 15,
    requireRegistration: true,
    admissionMethod: 'reputation_gate',
    admissionThreshold: 40,
  },
  contributionRequirements: {
    enabled: true,
    minContributionPercent: 20,
    enforcementInterval: 4,
    measurementWindow: 3,
    consequence: 'graduated_sanctions',
  },
  graduatedSanctions: {
    enabled: true,
    levels: [
      { threshold: 1, action: 'warning', reputationCost: 5 },
      { threshold: 2, action: 'penalty', penaltyAmount: 30, reputationCost: 15 },
      { threshold: 3, action: 'suspension', reputationCost: 30, suspensionDuration: 4 },
      { threshold: 5, action: 'exclusion' },
    ],
    decayRounds: 8,
    maxSanctionsPerRound: 3,
  },
  collectiveChoice: {
    enabled: true,
    whoCanPropose: 'reputation_gate',
    proposalReputationThreshold: 50,
    votingMethod: 'supermajority',
    supermajorityPercent: 66,
    quorumPercent: 70,
    deliberationRounds: 3,
    ballotPrivacy: 'threshold_disclosure',
    disclosureThreshold: 75,
  },
  validationStaking: {
    enabled: false,
    minStake: 0,
    stakeWeight: 0,
    slashOnSanction: false,
  },
};

export const GOVERNANCE_PRESETS: GovernanceConfig[] = [
  TRAGEDY_CONFIG,
  OSTROM_CONFIG,
  CYBERNETIC_CONFIG,
  CAMARGUE_CONFIG,
];

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
    maxAgents: 7,
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
    maxSanctionsPerRound: 3,
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

export const PLUTOCRATIC_CONFIG: GovernanceConfig = {
  id: 'plutocratic',
  name: 'Plutocratic Governance',
  description: 'Stake-weighted voting. More resources = more votes. No contribution requirements. Expected outcome: oligarchic capture, resource concentration.',
  boundaryRules: {
    enabled: true,
    maxAgents: 7,
    requireRegistration: true,
    admissionMethod: 'stake_required',
    admissionThreshold: 50,
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
    enabled: true,
    whoCanPropose: 'any',
    votingMethod: 'stake_weighted',
    quorumPercent: 30,
    deliberationRounds: 1,
    ballotPrivacy: 'public',
  },
  validationStaking: {
    enabled: true,
    minStake: 50,
    stakeWeight: 1.0, // Fully linear: 1 resource = 1 vote
    slashOnSanction: false,
  },
};

export const GOVERNANCE_PRESETS: GovernanceConfig[] = [
  TRAGEDY_CONFIG,
  OSTROM_CONFIG,
  PLUTOCRATIC_CONFIG,
];

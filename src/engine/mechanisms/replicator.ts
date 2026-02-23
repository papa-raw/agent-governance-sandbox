import type { AgentState, GovernanceConfig, Territory } from '../../types';

/**
 * Replicator dynamics prediction from Nicoli & Juarez (CryptoEconLab, 2025).
 *
 * Computes the predicted cooperation rate given the current governance
 * configuration and agent population. This serves as the mathematical
 * baseline against which actual agent behavior is measured.
 *
 * Cooperator payoff: π_C = rc(N_C+1)/N - c + R/(N_C+1)
 * Defector payoff:   π_D = rc(N_C)/N
 * Cooperation exists iff: Δ/N < n(t)·V(t) < Δ
 */
export function computeReplicatorPrediction(
  agents: AgentState[],
  governance: GovernanceConfig,
  territory: Territory,
): number {
  const active = agents.filter((a) => !a.excluded && !a.suspended);
  const N = active.length;
  if (N <= 1) return 1; // Single agent trivially cooperates

  // Current cooperators (agents who contributed more than they consumed last round)
  const cooperators = active.filter((a) => {
    const lastContrib = a.contributionHistory[a.contributionHistory.length - 1] ?? 0;
    const lastConsume = a.consumptionHistory[a.consumptionHistory.length - 1] ?? 0;
    return lastContrib >= lastConsume;
  });
  const N_C = cooperators.length;

  // Parameters derived from governance config
  const r = computeMultiplier(governance, territory);    // public goods multiplier
  const c = 1.0;                                         // normalized contribution cost
  const R = computeRewardPool(governance, territory);    // governance reward pool

  // Cooperator payoff
  const pi_C = (r * c * (N_C + 1)) / N - c + R / (N_C + 1);

  // Defector payoff
  const pi_D = (r * c * N_C) / N;

  // Cooperation advantage
  const delta = pi_C - pi_D;

  // Predicted equilibrium cooperation fraction
  // Using replicator dynamics: dx/dt = x(1-x)(π_C - π_D)
  // At equilibrium, either x=0, x=1, or π_C = π_D
  // The steady-state cooperation rate depends on the payoff differential

  if (delta > 0.1) {
    // Strong cooperation incentive — predict convergence toward full cooperation
    // Rate depends on strength of incentive
    const predicted = Math.min(1, 0.5 + delta * 0.3);
    return predicted;
  } else if (delta < -0.1) {
    // Defection is dominant — predict low cooperation
    const predicted = Math.max(0, 0.5 + delta * 0.3);
    return predicted;
  } else {
    // Mixed equilibrium near 50%
    return 0.5 + delta * 0.2;
  }
}

/**
 * Compute the public goods multiplier from governance config.
 * Higher governance structure → higher multiplier (cooperation is more rewarding).
 */
function computeMultiplier(governance: GovernanceConfig, territory: Territory): number {
  let r = 1.5; // Base multiplier (standard PGG)

  // Governance mechanisms increase the effective multiplier
  if (governance.boundaryRules.enabled) r += 0.2;
  if (governance.contributionRequirements.enabled) r += 0.3;
  if (governance.graduatedSanctions.enabled) r += 0.3;
  if (governance.collectiveChoice.enabled) r += 0.2;

  // Territory health affects multiplier — healthier territory rewards cooperation more
  const avgHealth = territory.zones.reduce(
    (s, z) => s + z.resourceLevel / Math.max(z.maxCapacity, 1),
    0,
  ) / Math.max(territory.zones.length, 1);

  r *= 0.5 + avgHealth; // Scales from 0.5x to 1.5x based on territory health

  return r;
}

/**
 * Compute the reward pool from governance config.
 * This represents the additional benefit from being in the governance system.
 */
function computeRewardPool(governance: GovernanceConfig, territory: Territory): number {
  let R = 0;

  // Contribution requirements create a shared reward pool
  if (governance.contributionRequirements.enabled) {
    R += governance.contributionRequirements.minContributionPercent * 0.1;
  }

  // Staking creates a commitment signal
  if (governance.validationStaking.enabled) {
    R += governance.validationStaking.minStake * 0.01;
  }

  // Territory regeneration contributes to the reward
  const avgRegen = territory.zones.reduce((s, z) => s + z.regenerationRate, 0) / Math.max(territory.zones.length, 1);
  R += avgRegen * 0.5;

  return R;
}

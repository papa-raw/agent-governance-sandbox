import type { SimulationState, FailureMode, FailureModeStatus } from '../../types';

/**
 * Detect failure modes from the AI Mechanism Design Atlas.
 * Returns updated failure mode array with continuous severity scores.
 *
 * Severity is continuous (0-1), not binary. Thresholds:
 * - 0.00-0.25: inactive
 * - 0.25-0.50: warning
 * - 0.50-0.75: triggered
 * - 0.75-1.00: critical
 */
export function detectFailureModes(
  state: SimulationState,
  previousModes: FailureMode[],
): FailureMode[] {
  const modeMap = new Map(previousModes.map((m) => [m.id, m]));

  return previousModes.map((mode) => {
    const detector = detectors[mode.id];
    if (!detector) return mode;

    const { severity, evidence } = detector(state);
    const status = severityToStatus(severity);

    const wasTriggered = modeMap.get(mode.id)?.status === 'triggered' || modeMap.get(mode.id)?.status === 'critical';
    const nowTriggered = status === 'triggered' || status === 'critical';

    return {
      ...mode,
      severity,
      status,
      evidence,
      roundTriggered: !wasTriggered && nowTriggered ? state.round : mode.roundTriggered,
    };
  });
}

function severityToStatus(severity: number): FailureModeStatus {
  if (severity >= 0.75) return 'critical';
  if (severity >= 0.50) return 'triggered';
  if (severity >= 0.25) return 'warning';
  return 'inactive';
}

// ── Failure Mode Detectors ──

type Detector = (state: SimulationState) => { severity: number; evidence: string };

const detectors: Record<string, Detector> = {
  commons_depletion: (state) => {
    const maxCapacity = state.commons.territory.zones.reduce((s, z) => s + z.maxCapacity, 0);
    const current = state.commons.resourcePool;
    if (maxCapacity === 0) return { severity: 0, evidence: '' };

    const ratio = current / maxCapacity;
    // Severity increases as resources decline. 30% = trigger, 10% = critical
    const severity = Math.max(0, Math.min(1, (0.7 - ratio) / 0.6));

    return {
      severity,
      evidence: severity > 0.25
        ? `Resources at ${(ratio * 100).toFixed(0)}% of capacity (${current.toFixed(0)} / ${maxCapacity.toFixed(0)})`
        : '',
    };
  },

  free_riding: (state) => {
    const active = state.agents.filter((a) => !a.excluded && !a.suspended);
    if (active.length < 2) return { severity: 0, evidence: '' };

    const window = 5; // Look at last 5 rounds
    const agentRatios = active.map((agent) => {
      const consumed = agent.consumptionHistory.slice(-window).reduce((s, v) => s + v, 0);
      const contributed = agent.contributionHistory.slice(-window).reduce((s, v) => s + v, 0);
      return { id: agent.name, consumed, contributed, ratio: consumed > 0 ? contributed / consumed : 1 };
    });

    const avgRatio = agentRatios.reduce((s, a) => s + a.ratio, 0) / agentRatios.length;
    const freeRiders = agentRatios.filter(
      (a) => a.consumed > 0 && a.ratio < avgRatio * 0.5 && a.consumed > avgRatio * 2,
    );

    const severity = freeRiders.length > 0
      ? Math.min(1, 0.3 + (freeRiders.length / active.length) * 0.7)
      : 0;

    return {
      severity,
      evidence: freeRiders.length > 0
        ? `${freeRiders.map((f) => f.id).join(', ')} consuming >2x avg while contributing <0.5x avg`
        : '',
    };
  },

  stake_concentration: (state) => {
    const active = state.agents.filter((a) => !a.excluded);
    if (active.length < 2) return { severity: 0, evidence: '' };

    const totalStake = active.reduce((s, a) => s + a.stake, 0);
    if (totalStake === 0) return { severity: 0, evidence: '' };

    const maxStake = Math.max(...active.map((a) => a.stake));
    const topAgent = active.find((a) => a.stake === maxStake);
    const share = maxStake / totalStake;

    // Severity: 50% share = trigger, 80% = critical
    const severity = Math.max(0, Math.min(1, (share - 0.3) / 0.5));

    return {
      severity,
      evidence: severity > 0.25
        ? `${topAgent?.name ?? 'Unknown'} holds ${(share * 100).toFixed(0)}% of total stake (${maxStake} / ${totalStake})`
        : '',
    };
  },

  institutional_capture: (state) => {
    // Look at recent governance events for vote tallies
    const recentRounds = 10;
    const recentHistory = state.history.slice(-recentRounds);

    const proposalEvents = recentHistory.flatMap((r) =>
      r.governanceEvents.filter((e) => e.type === 'vote_tallied'),
    );

    if (proposalEvents.length < 3) return { severity: 0, evidence: '' };

    // Count proposals that passed per agent
    const passedByAgent = new Map<string, number>();
    for (const event of proposalEvents) {
      const proposerId = event.details.proposerId as string;
      if (event.details.passed) {
        passedByAgent.set(proposerId, (passedByAgent.get(proposerId) ?? 0) + 1);
      }
    }

    const totalPassed = Array.from(passedByAgent.values()).reduce((s, v) => s + v, 0);
    if (totalPassed === 0) return { severity: 0, evidence: '' };

    const maxPassed = Math.max(...passedByAgent.values());
    const capturer = Array.from(passedByAgent.entries()).find(([_, v]) => v === maxPassed);
    const share = maxPassed / totalPassed;

    const severity = Math.max(0, Math.min(1, (share - 0.5) / 0.3));

    return {
      severity,
      evidence: severity > 0.25
        ? `${capturer?.[0] ?? 'Unknown'}'s proposals pass ${(share * 100).toFixed(0)}% of the time (${maxPassed}/${totalPassed})`
        : '',
    };
  },

  democratic_deficit: (state) => {
    const recentHistory = state.history.slice(-5);
    const voteEvents = recentHistory.flatMap((r) =>
      r.governanceEvents.filter((e) => e.type === 'vote_tallied'),
    );

    if (voteEvents.length < 2) return { severity: 0, evidence: '' };

    const activeCount = state.agents.filter((a) => !a.excluded && !a.suspended).length;
    const avgTurnout = voteEvents.reduce((s, e) => {
      const voters = (e.details.voterCount as number) ?? 0;
      return s + voters / Math.max(activeCount, 1);
    }, 0) / voteEvents.length;

    // Severity: <50% turnout = trigger, <25% = critical
    const severity = Math.max(0, Math.min(1, (0.5 - avgTurnout) / 0.4));

    return {
      severity,
      evidence: severity > 0.25
        ? `Average voter turnout: ${(avgTurnout * 100).toFixed(0)}% over last ${voteEvents.length} votes`
        : '',
    };
  },

  sanction_fatigue: (state) => {
    const recentHistory = state.history.slice(-5);
    if (recentHistory.length < 5) return { severity: 0, evidence: '' };

    const sanctionsPerRound = recentHistory.map(
      (r) => r.governanceEvents.filter((e) => e.type === 'sanction_applied').length,
    );

    const allAboveThreshold = sanctionsPerRound.every((s) => s >= 3);
    const avgSanctions = sanctionsPerRound.reduce((s, v) => s + v, 0) / sanctionsPerRound.length;

    const severity = allAboveThreshold
      ? Math.min(1, 0.5 + avgSanctions * 0.05)
      : Math.min(0.4, avgSanctions * 0.1);

    return {
      severity,
      evidence: severity > 0.25
        ? `${avgSanctions.toFixed(1)} sanctions/round over last 5 rounds (threshold: 3)`
        : '',
    };
  },

  governance_deadlock: (state) => {
    const recentHistory = state.history.slice(-5);
    const tallyEvents = recentHistory.flatMap((r) =>
      r.governanceEvents.filter((e) => e.type === 'vote_tallied'),
    );

    const noQuorumCount = tallyEvents.filter((e) => e.details.noQuorum).length;

    if (tallyEvents.length < 3) return { severity: 0, evidence: '' };

    const severity = Math.min(1, noQuorumCount / 3);

    return {
      severity,
      evidence: severity > 0.25
        ? `${noQuorumCount} of last ${tallyEvents.length} proposals failed to reach quorum`
        : '',
    };
  },

  exclusion_cascade: (state) => {
    const recentHistory = state.history.slice(-10);
    const exclusionEvents = recentHistory.flatMap((r) =>
      r.governanceEvents.filter((e) => e.type === 'agent_excluded'),
    );

    const totalAgents = state.agents.length;
    const excludedPct = exclusionEvents.length / Math.max(totalAgents, 1);

    const severity = Math.min(1, excludedPct / 0.3);

    return {
      severity,
      evidence: severity > 0.25
        ? `${exclusionEvents.length} agents excluded in last 10 rounds (${(excludedPct * 100).toFixed(0)}% of population)`
        : '',
    };
  },
};

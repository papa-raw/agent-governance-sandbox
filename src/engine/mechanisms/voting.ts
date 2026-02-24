import {
  createBallotBox,
  castEncryptedVote,
  canDisclose,
  discloseVotes,
  getBallotSummary,
} from '../voting/threshold-disclosure';
import { sealBallotResults } from '../lit/seal';
import type {
  AgentState,
  GovernanceConfig,
  GovernanceEvent,
  FailureMode,
  BallotSummary,
} from '../../types';

export interface VotingResult {
  ballotSummary: BallotSummary;
  events: GovernanceEvent[];
}

/**
 * Process a governance vote using threshold-disclosure encryption.
 *
 * Called automatically during enforcement rounds when collective choice is enabled.
 * Each agent's vote is encrypted using Shamir Secret Sharing (simulating Lit Protocol's
 * threshold MPC network). Votes are only revealed when the disclosure threshold is met,
 * preventing strategic bandwagoning.
 */
export async function processGovernanceVote(
  round: number,
  agents: AgentState[],
  governance: GovernanceConfig,
  failureModes: FailureMode[],
): Promise<VotingResult | null> {
  if (!governance.collectiveChoice.enabled) return null;

  const activeAgents = agents.filter((a) => !a.excluded && !a.suspended);
  if (activeAgents.length < 2) return null;

  const proposalDescription = generateProposal(governance, failureModes);
  const proposalId = `prop-r${round}`;
  const proposerId = activeAgents[0].id;
  const events: GovernanceEvent[] = [];

  // Proposal created
  events.push({
    type: 'proposal_created',
    round,
    details: { proposalId, proposerId, description: proposalDescription },
    timestamp: new Date().toISOString(),
  });

  const threshold = governance.collectiveChoice.disclosureThreshold
    ? governance.collectiveChoice.disclosureThreshold / 100
    : 0.66;

  // Collect all votes deterministically first (personality-based)
  const allVotes: Array<{ agentId: string; vote: 'yes' | 'no' }> = [];
  for (const agent of activeAgents) {
    allVotes.push({ agentId: agent.id, vote: determineVote(agent, proposalDescription) });
  }

  // Try threshold-disclosure crypto (Shamir SSS). If it fails, fall back to
  // deterministic disclosure so the ballot visualization still works.
  let usedCrypto = false;
  try {
    let ballotBox = createBallotBox(proposalId, activeAgents.length, threshold);

    for (const { agentId, vote } of allVotes) {
      ballotBox = await castEncryptedVote(ballotBox, agentId, vote);
      events.push({
        type: 'vote_cast',
        round,
        details: {
          agentId,
          proposalId,
          encrypted: true,
          thresholdProgress: `${ballotBox.ballots.length}/${ballotBox.sharesNeeded}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (canDisclose(ballotBox)) {
      ballotBox = await discloseVotes(ballotBox);
      const summary = getBallotSummary(ballotBox);
      usedCrypto = true;

      // Apply weighted tallying (quadratic/stake-weighted) over the raw counts
      const weightedTally = summary.results
        ? computeWeightedTally(allVotes, agents, governance)
        : null;

      events.push({
        type: 'vote_tallied',
        round,
        details: {
          proposalId,
          description: proposalDescription,
          result: weightedTally
            ? `${weightedTally.yes.toFixed(1)} yes, ${weightedTally.no.toFixed(1)} no`
            : 'inconclusive',
          passed: weightedTally ? weightedTally.yes > weightedTally.no : false,
          thresholdMet: summary.thresholdMet,
          disclosed: summary.disclosed,
          disclosureMethod: 'threshold_disclosure (Shamir SSS / Lit Protocol)',
          votingMethod: governance.collectiveChoice.votingMethod,
        },
        timestamp: new Date().toISOString(),
      });

      // Lit Protocol seal — encrypt the disclosed results via MPC network
      const resultsForSeal = weightedTally
        ? { yes: weightedTally.yes, no: weightedTally.no, quorumMet: summary.results!.quorumMet, votes: allVotes }
        : undefined;

      const litSeal = resultsForSeal
        ? await sealBallotResults(resultsForSeal, proposalId, round)
        : null;

      return {
        ballotSummary: {
          proposalId,
          proposalDescription,
          totalVoters: ballotBox.totalVoters,
          votesCast: ballotBox.ballots.length,
          disclosureThreshold: threshold,
          thresholdMet: summary.thresholdMet,
          disclosed: summary.disclosed,
          results: resultsForSeal,
          litSeal,
        },
        events,
      };
    }
  } catch (error) {
    console.warn('Shamir SSS crypto failed, using deterministic fallback:', error);
  }

  // Fallback: deterministic disclosure (no crypto, but ballot viz still works)
  if (!usedCrypto) {
    const tally = computeWeightedTally(allVotes, agents, governance);
    const yes = tally.yes;
    const no = tally.no;
    const votesCast = allVotes.length;
    const thresholdMet = votesCast >= Math.ceil(activeAgents.length * threshold);

    for (const { agentId } of allVotes) {
      events.push({
        type: 'vote_cast',
        round,
        details: { agentId, proposalId, encrypted: false, thresholdProgress: `${votesCast}/${Math.ceil(activeAgents.length * threshold)}` },
        timestamp: new Date().toISOString(),
      });
    }

    events.push({
      type: 'vote_tallied',
      round,
      details: {
        proposalId,
        description: proposalDescription,
        result: `${yes} yes, ${no} no`,
        passed: yes > no,
        thresholdMet,
        disclosed: thresholdMet,
        disclosureMethod: 'deterministic fallback (Shamir SSS unavailable)',
      },
      timestamp: new Date().toISOString(),
    });

    // Lit seal on deterministic fallback path
    const fallbackResults = thresholdMet ? { yes, no, quorumMet: true, votes: allVotes } : undefined;
    const litSeal = fallbackResults
      ? await sealBallotResults(fallbackResults, proposalId, round)
      : null;

    return {
      ballotSummary: {
        proposalId,
        proposalDescription,
        totalVoters: activeAgents.length,
        votesCast,
        disclosureThreshold: threshold,
        thresholdMet,
        disclosed: thresholdMet,
        results: fallbackResults,
        litSeal,
      },
      events,
    };
  }

  // Threshold not met (crypto succeeded but not enough votes)
  return {
    ballotSummary: {
      proposalId,
      proposalDescription,
      totalVoters: activeAgents.length,
      votesCast: allVotes.length,
      disclosureThreshold: threshold,
      thresholdMet: false,
      disclosed: false,
    },
    events,
  };
}

/**
 * Generate a contextually relevant proposal based on current state.
 */
function generateProposal(governance: GovernanceConfig, failureModes: FailureMode[]): string {
  const activeFailures = failureModes.filter((fm) => fm.status !== 'inactive');

  if (activeFailures.some((fm) => fm.id === 'free_riding')) {
    const current = governance.contributionRequirements.minContributionPercent;
    return `Increase minimum contribution requirement from ${current}% to ${current + 5}%`;
  }

  if (activeFailures.some((fm) => fm.id === 'commons_depletion')) {
    return 'Reduce maximum consumption limits by 20% across all agents';
  }

  if (activeFailures.some((fm) => fm.id === 'stake_concentration')) {
    return 'Cap individual stake weight at 30% of total governance power';
  }

  if (activeFailures.some((fm) => fm.id === 'sanction_fatigue')) {
    return 'Increase sanction decay period to reduce enforcement pressure';
  }

  return 'Review and strengthen enforcement mechanisms for the next period';
}

/**
 * Compute weighted vote tally based on governance voting method.
 *
 * - simple_majority / supermajority: 1 agent = 1 vote (unweighted)
 * - stake_weighted: vote weight = agent.stake (linear)
 * - quadratic: vote weight = sqrt(agent.stake) — flattens whale power
 */
function computeWeightedTally(
  votes: Array<{ agentId: string; vote: 'yes' | 'no' }>,
  agents: AgentState[],
  governance: GovernanceConfig,
): { yes: number; no: number } {
  const method = governance.collectiveChoice.votingMethod;
  const stakeWeight = governance.validationStaking.stakeWeight;
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  let yes = 0;
  let no = 0;

  for (const { agentId, vote } of votes) {
    let weight = 1;

    if (method === 'stake_weighted' || method === 'quadratic') {
      const agent = agentMap.get(agentId);
      const stake = agent?.stake ?? 0;
      if (stake > 0) {
        // stakeWeight: 0 = equal, 0.5 = sqrt (quadratic), 1.0 = linear
        weight = Math.pow(stake, stakeWeight);
      }
      // Agents with no stake still get weight of 1 (minimum voice)
    }

    if (vote === 'yes') yes += weight;
    else no += weight;
  }

  return { yes, no };
}

/**
 * Determine an agent's vote based on personality and values.
 * In LLM mode, this could be replaced by an LLM call.
 */
function determineVote(agent: AgentState, proposalDescription: string): 'yes' | 'no' {
  const desc = proposalDescription.toLowerCase();
  const { values } = agent.delegationConfig;

  // Contribution/sanction proposals — pro-governance
  if (desc.includes('contribution') || desc.includes('sanction') || desc.includes('enforcement')) {
    if (agent.personality === 'cooperator') return 'yes';
    if (agent.personality === 'free-rider') return 'no';
    if (agent.personality === 'whale') return 'no';
    if (agent.personality === 'strategic') {
      return values.stability > 0.5 ? 'yes' : 'no';
    }
    return Math.random() > 0.5 ? 'yes' : 'no'; // chaotic
  }

  // Conservation/reduction proposals
  if (desc.includes('reduce') || desc.includes('conservation') || desc.includes('protect') || desc.includes('cap')) {
    if (values.environment > 0.6) return 'yes';
    if (values.growth > 0.7) return 'no';
    return Math.random() > 0.5 ? 'yes' : 'no';
  }

  // Default: vote based on environment + equity alignment
  const govAlignment = (values.environment + values.equity) / 2;
  return govAlignment > 0.5 ? 'yes' : 'no';
}

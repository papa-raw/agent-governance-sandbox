import { split, combine } from 'shamir-secret-sharing';

/**
 * Threshold Disclosure Voting
 *
 * Implements the threshold disclosure mechanism from the NBER Feb 2026 paper:
 * votes are encrypted at cast time and can only be revealed when a sufficient
 * majority has been reached, preventing strategic bandwagoning.
 *
 * Uses Shamir's Secret Sharing as a client-side demonstration of the concept.
 * In production, this would use Lit Protocol's threshold MPC network for
 * decentralized trust guarantees.
 *
 * Flow:
 * 1. Agent casts vote → ballot is split into N Shamir shares
 * 2. Each share is stored independently (simulating distribution to Lit nodes)
 * 3. When disclosureThreshold% of agents have voted, enough shares exist
 *    to reconstruct all ballots
 * 4. Votes are revealed and tallied simultaneously
 */

export interface EncryptedBallot {
  agentId: string;
  proposalId: string;
  shares: Uint8Array[];  // N shares, threshold T required to reconstruct
  dataHash: string;       // SHA-256 hash of plaintext ballot (for integrity)
  timestamp: string;
}

export interface BallotBox {
  proposalId: string;
  totalVoters: number;
  disclosureThreshold: number;  // 0-1, e.g. 0.66 = 66%
  sharesNeeded: number;          // computed from threshold * totalVoters
  ballots: EncryptedBallot[];
  disclosed: boolean;
  results?: {
    yes: number;
    no: number;
    quorumMet: boolean;
    votes: Array<{ agentId: string; vote: 'yes' | 'no' }>;
  };
}

/**
 * Create a new ballot box for a proposal.
 */
export function createBallotBox(
  proposalId: string,
  totalVoters: number,
  disclosureThreshold: number,
): BallotBox {
  return {
    proposalId,
    totalVoters,
    disclosureThreshold,
    sharesNeeded: Math.ceil(totalVoters * disclosureThreshold),
    ballots: [],
    disclosed: false,
  };
}

/**
 * Cast an encrypted vote using Shamir Secret Sharing.
 * The ballot is split into `totalVoters` shares, requiring `sharesNeeded`
 * to reconstruct. This simulates threshold encryption where votes can only
 * be revealed when enough participants have voted.
 */
export async function castEncryptedVote(
  ballotBox: BallotBox,
  agentId: string,
  vote: 'yes' | 'no',
): Promise<BallotBox> {
  const ballot = JSON.stringify({ agentId, vote, proposalId: ballotBox.proposalId });
  const secret = new TextEncoder().encode(ballot);

  // Split the ballot into N shares, threshold T required
  const shares = await split(secret, ballotBox.totalVoters, ballotBox.sharesNeeded);

  // Compute integrity hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', secret);
  const hashArray = new Uint8Array(hashBuffer);
  const dataHash = btoa(String.fromCharCode(...hashArray));

  const encryptedBallot: EncryptedBallot = {
    agentId,
    proposalId: ballotBox.proposalId,
    shares: shares.map((s) => new Uint8Array(s)),
    dataHash,
    timestamp: new Date().toISOString(),
  };

  return {
    ...ballotBox,
    ballots: [...ballotBox.ballots, encryptedBallot],
  };
}

/**
 * Check if enough votes have been cast to meet the disclosure threshold.
 */
export function canDisclose(ballotBox: BallotBox): boolean {
  return ballotBox.ballots.length >= ballotBox.sharesNeeded && !ballotBox.disclosed;
}

/**
 * Disclose all votes by reconstructing ballots from shares.
 * Only works when the disclosure threshold has been met.
 *
 * In production with Lit Protocol, this would involve requesting
 * threshold decryption from the Lit MPC network, which would only
 * succeed if the access control condition (enough votes cast) is met.
 */
export async function discloseVotes(ballotBox: BallotBox): Promise<BallotBox> {
  if (!canDisclose(ballotBox)) {
    return ballotBox;
  }

  const votes: Array<{ agentId: string; vote: 'yes' | 'no' }> = [];

  for (const ballot of ballotBox.ballots) {
    try {
      // Reconstruct from the minimum required shares
      const sharesToUse = ballot.shares.slice(0, ballotBox.sharesNeeded);
      const reconstructed = await combine(sharesToUse);
      const ballotData = JSON.parse(new TextDecoder().decode(reconstructed));

      votes.push({
        agentId: ballotData.agentId,
        vote: ballotData.vote,
      });
    } catch (error) {
      console.warn(`Failed to reconstruct ballot for ${ballot.agentId}:`, error);
    }
  }

  const yes = votes.filter((v) => v.vote === 'yes').length;
  const no = votes.filter((v) => v.vote === 'no').length;

  return {
    ...ballotBox,
    disclosed: true,
    results: {
      yes,
      no,
      quorumMet: ballotBox.ballots.length >= ballotBox.sharesNeeded,
      votes,
    },
  };
}

/**
 * Get a summary of the ballot box state (safe to display publicly).
 * Does NOT reveal individual votes until disclosure.
 */
export function getBallotSummary(ballotBox: BallotBox): {
  proposalId: string;
  votesCast: number;
  totalVoters: number;
  thresholdMet: boolean;
  disclosed: boolean;
  results?: { yes: number; no: number; quorumMet: boolean };
} {
  return {
    proposalId: ballotBox.proposalId,
    votesCast: ballotBox.ballots.length,
    totalVoters: ballotBox.totalVoters,
    thresholdMet: canDisclose(ballotBox),
    disclosed: ballotBox.disclosed,
    results: ballotBox.results
      ? { yes: ballotBox.results.yes, no: ballotBox.results.no, quorumMet: ballotBox.results.quorumMet }
      : undefined,
  };
}

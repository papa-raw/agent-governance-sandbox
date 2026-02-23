import type { RoundResult, SimulationState } from '../../types';

/**
 * Storacha (formerly web3.storage) integration for CID-rooted state storage.
 *
 * Architecture: browser-first with optional upload to decentralized storage.
 * - Without credentials: computes CIDs locally using Web Crypto API (SHA-256)
 * - With delegation proof: uploads JSON to Storacha network and returns IPFS CID
 *
 * Every round's state is content-addressed — identical states produce identical CIDs,
 * providing built-in integrity verification for the governance audit trail.
 */

let storachaClient: StorachaClient | null = null;

interface StorachaClient {
  uploadFile: (file: File) => Promise<string>;
}

/**
 * Initialize the Storacha client if credentials are available.
 * Call this once at app startup.
 */
export async function initStoracha(): Promise<boolean> {
  const proofKey = import.meta.env.VITE_STORACHA_PROOF as string | undefined;
  if (!proofKey) {
    console.log('Storacha: No proof configured — using local CID computation');
    return false;
  }

  try {
    const { create } = await import('@storacha/client');
    const client = await create();

    // Parse and apply delegation proof
    const { extract } = await import('@storacha/client/delegation');
    const proofBytes = Uint8Array.from(atob(proofKey), (c) => c.charCodeAt(0));
    const delegation = await extract(proofBytes);

    if (!delegation.ok) {
      console.warn('Storacha: Invalid delegation proof');
      return false;
    }

    const space = await client.addSpace(delegation.ok);
    await client.setCurrentSpace(space.did());

    storachaClient = {
      uploadFile: async (file: File) => {
        const cid = await client.uploadFile(file);
        return cid.toString();
      },
    };

    console.log('Storacha: Connected to decentralized storage');
    return true;
  } catch (error) {
    console.warn('Storacha: Failed to initialize client:', error);
    return false;
  }
}

/**
 * Store a round result and return its CID.
 * Uses Storacha network if available, otherwise computes CID locally.
 */
export async function storeRoundState(result: RoundResult): Promise<string> {
  const json = JSON.stringify(result, null, 2);

  if (storachaClient) {
    const file = new File([json], `round-${result.round}.json`, {
      type: 'application/json',
    });
    return storachaClient.uploadFile(file);
  }

  // Local CID computation using Web Crypto API
  return computeLocalCID(json);
}

/**
 * Store a complete simulation summary and return its CID.
 */
export async function storeSimulationState(state: SimulationState): Promise<string> {
  const summary = {
    id: state.id,
    round: state.round,
    status: state.status,
    governance: state.governance.id,
    commonsLevel: state.commons.resourcePool,
    agents: state.agents.map((a) => ({
      id: a.id,
      name: a.name,
      resources: a.resources,
      reputation: a.reputation,
      excluded: a.excluded,
    })),
    failureModes: state.failureModes
      .filter((fm) => fm.status !== 'inactive')
      .map((fm) => ({
        id: fm.id,
        name: fm.name,
        severity: fm.severity,
        status: fm.status,
      })),
    roundCIDs: state.history.map((r) => r.cid).filter(Boolean),
  };

  const json = JSON.stringify(summary, null, 2);

  if (storachaClient) {
    const file = new File([json], `simulation-${state.id}.json`, {
      type: 'application/json',
    });
    return storachaClient.uploadFile(file);
  }

  return computeLocalCID(json);
}

/**
 * Compute a CID-like content hash locally using SHA-256.
 * This produces a base64url-encoded hash prefixed with 'bafy' to indicate
 * it's a local computation (not a true IPFS CID, but content-addressed).
 *
 * For hackathon purposes, this provides verifiability without requiring
 * network connectivity or Storacha credentials.
 */
async function computeLocalCID(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  // Base64url encode
  const base64 = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Prefix with 'bafy' to indicate CID-like format
  return `bafy${base64}`;
}

/**
 * Check if Storacha is connected to the decentralized network.
 */
export function isStorachaConnected(): boolean {
  return storachaClient !== null;
}

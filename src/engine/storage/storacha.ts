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
let initPromise: Promise<boolean> | null = null;

interface StorachaClient {
  uploadFile: (file: File) => Promise<string>;
}

/**
 * Initialize the Storacha client if credentials are available.
 * Call this once at app startup. Safe to call multiple times.
 */
export async function initStoracha(): Promise<boolean> {
  if (storachaClient) return true;
  if (!initPromise) {
    initPromise = doInitStoracha();
  }
  return initPromise;
}

async function doInitStoracha(): Promise<boolean> {
  const proofKey = import.meta.env.VITE_STORACHA_PROOF as string | undefined;
  const signerKey = import.meta.env.VITE_STORACHA_KEY as string | undefined;
  if (!proofKey) {
    console.log('Storacha: No proof configured — using local CID computation');
    return false;
  }

  try {
    // Use "Bring Your Own Delegations" pattern from Storacha docs:
    // stable key + memory store + delegation proof
    const Client = await import('@storacha/client');
    const Proof = await import('@storacha/client/proof');
    const { StoreMemory } = await import('@storacha/client/stores/memory');

    let client;
    if (signerKey) {
      const { Signer } = await import('@storacha/client/principal/ed25519');
      const principal = Signer.parse(signerKey);
      client = await Client.create({ principal, store: new StoreMemory() });
    } else {
      client = await Client.create({ store: new StoreMemory() });
    }

    const proof = await Proof.parse(proofKey);
    const space = await client.addSpace(proof);
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
 * Waits for init to complete to avoid race conditions.
 */
export async function storeRoundState(result: RoundResult): Promise<string> {
  // Wait for init to finish (if it was started) before checking client
  if (initPromise) {
    await initPromise;
  }

  const json = JSON.stringify(result, null, 2);

  if (storachaClient) {
    try {
      const file = new File([json], `round-${result.round}.json`, {
        type: 'application/json',
      });
      return await storachaClient.uploadFile(file);
    } catch (error) {
      console.warn('Storacha: Upload failed, falling back to local CID —', error);
      // Fall through to local CID
    }
  }

  // Local CID computation using Web Crypto API
  return computeLocalCID(json);
}

/**
 * Store a complete simulation summary and return its CID.
 */
export async function storeSimulationState(state: SimulationState): Promise<string> {
  if (initPromise) await initPromise;

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

/**
 * Check if a CID is a local pseudo-CID (base64url SHA-256, not a real IPFS CID).
 * Real CIDs use base32 encoding (lowercase a-z, digits 2-7).
 * Local pseudo-CIDs contain base64url characters: uppercase letters, digits 0/1/8/9, hyphens, underscores.
 */
export function isLocalPseudoCID(cid: string): boolean {
  if (!cid.startsWith('bafy')) return false;
  const suffix = cid.slice(4);
  return /[A-Z0189_-]/.test(suffix);
}

/**
 * Get a gateway URL for a given CID.
 * Returns null for local pseudo-CIDs (they aren't on IPFS).
 */
export function getGatewayUrl(cid: string): string | null {
  if (isLocalPseudoCID(cid)) return null;
  return `https://${cid}.ipfs.storacha.link`;
}

/**
 * Fetch round/simulation state from the Storacha IPFS gateway.
 * Returns the parsed JSON object, or null if retrieval fails.
 * Only works for real CIDs uploaded via Storacha — local pseudo-CIDs return null.
 */
export async function fetchFromGateway<T = unknown>(cid: string): Promise<T | null> {
  const url = getGatewayUrl(cid);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    console.warn(`Storacha: Failed to fetch CID ${cid.slice(0, 12)}... from gateway`);
    return null;
  }
}

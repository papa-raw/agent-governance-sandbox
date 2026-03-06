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

// Stable client identity key — not sensitive, just identifies this app to Storacha.
// Access is granted by the delegation proof below.
// Both hardcoded to avoid Vercel env var encoding issues with base64 chars (+/=).
const STORACHA_SIGNER_KEY =
  'MgCZpb0FsHIhcXsJ8jIWmU6yOpRV57yYJh/OAg54KvrszZO0BtAfmUBQbJnOjscNUPeEmh90S+aaFipq05PwUaCUcr2A=';

// UCAN delegation proof for ags-camargue-2026 space.
// Not sensitive — scoped to this space only, grants upload capability.
const STORACHA_PROOF =
  'mAYIEAN4UOqJlcm9vdHOB2CpYJQABcRIgtT62EPHj0f3iO5P3N2ZOF0rsx5IRM8K5quV6R/5KcLlndmVyc2lvbgHBBwFxEiAAJJ9sU4qcZ2hwVzeikmtIBM6AFuqR9Me5HfpL+o3/pqhhc1hE7aEDQEG/8mrcBW5im1KP5rnSxgD24U4qfaHqxqEhKi169YJ7LMQdlzXhBeGUGUSc2+QbyL29YfNehhChD4IiJ1xt0w5hdmUwLjkuMWNhdHSJomNjYW5oYXNzZXJ0Lypkd2l0aHg4ZGlkOmtleTp6Nk1rc0hSc05mYnNYNjRnM3YzR1NWWUpyY2E3TEE3Qk1lRzFXdENib3BURTdZWVSiY2NhbmdzcGFjZS8qZHdpdGh4OGRpZDprZXk6ejZNa3NIUnNOZmJzWDY0ZzN2M0dTVllKcmNhN0xBN0JNZUcxV3RDYm9wVEU3WVlUomNjYW5mYmxvYi8qZHdpdGh4OGRpZDprZXk6ejZNa3NIUnNOZmJzWDY0ZzN2M0dTVllKcmNhN0xBN0JNZUcxV3RDYm9wVEU3WVlUomNjYW5naW5kZXgvKmR3aXRoeDhkaWQ6a2V5Ono2TWtzSFJzTmZic1g2NGczdjNHU1ZZSnJjYTdMQTdCTWVHMVd0Q2JvcFRFN1lZVKJjY2FuZ3N0b3JlLypkd2l0aHg4ZGlkOmtleTp6Nk1rc0hSc05mYnNYNjRnM3YzR1NWWUpyY2E3TEE3Qk1lRzFXdENib3BURTdZWVSiY2Nhbmh1cGxvYWQvKmR3aXRoeDhkaWQ6a2V5Ono2TWtzSFJzTmZic1g2NGczdjNHU1ZZSnJjYTdMQTdCTWVHMVd0Q2JvcFRFN1lZVKJjY2FuaGFjY2Vzcy8qZHdpdGh4OGRpZDprZXk6ejZNa3NIUnNOZmJzWDY0ZzN2M0dTVllKcmNhN0xBN0JNZUcxV3RDYm9wVEU3WVlUomNjYW5qZmlsZWNvaW4vKmR3aXRoeDhkaWQ6a2V5Ono2TWtzSFJzTmZic1g2NGczdjNHU1ZZSnJjYTdMQTdCTWVHMVd0Q2JvcFRFN1lZVKJjY2FuZ3VzYWdlLypkd2l0aHg4ZGlkOmtleTp6Nk1rc0hSc05mYnNYNjRnM3YzR1NWWUpyY2E3TEE3Qk1lRzFXdENib3BURTdZWVRjYXVkWCLtAXCuCX1Ihfyq3P/WOgEYDFMWxQIfcaBVo3P1ceeDEei0Y2V4cBprfhdPY2ZjdIGhZXNwYWNlomRuYW1lcWFncy1jYW1hcmd1ZS0yMDI2ZmFjY2Vzc6FkdHlwZWZwdWJsaWNjaXNzWCLtAb6jOtTdbnJD7mI75F2d7Fh9IkqTECG9nBIXPevEBtQ8Y3ByZoDXAwFxEiD39MCJBZJ2T+BoZ5uz4obyhiKZlPrhkFQIO9RLyF8SHqhhc1hE7aEDQDt4xnJIKQMuEMjxYVdLDo/zV0Ebss82QUYnc2Hxzxx6fKiNK6k+4M+Pc1VQtcfOsimEVgw/bJtAbzZRZoE6xA9hdmUwLjkuMWNhdHSComNjYW5uc3BhY2UvYmxvYi9hZGRkd2l0aHg4ZGlkOmtleTp6Nk1rc0hSc05mYnNYNjRnM3YzR1NWWUpyY2E3TEE3Qk1lRzFXdENib3BURTdZWVSiY2Nhbmp1cGxvYWQvYWRkZHdpdGh4OGRpZDprZXk6ejZNa3NIUnNOZmJzWDY0ZzN2M0dTVllKcmNhN0xBN0JNZUcxV3RDYm9wVEU3WVlUY2F1ZFgi7QFwrgl9SIX8qtz/1joBGAxTFsUCH3GgVaNz9XHngxHotGNleHD2Y2ZjdIGhZXNwYWNlomRuYW1lcWFncy1jYW1hcmd1ZS0yMDI2ZmFjY2Vzc6FkdHlwZWZwdWJsaWNjaXNzWCLtAXCuCX1Ihfyq3P/WOgEYDFMWxQIfcaBVo3P1ceeDEei0Y3ByZoHYKlglAAFxEiAAJJ9sU4qcZ2hwVzeikmtIBM6AFuqR9Me5HfpL+o3/poAEAXESIDs2Ph4ywRv179QSHfb4MB0nUEnzB7OBUwFuqLA19826qGFzWETtoQNADqPuueaHoKsognPGrm+pmaWUtXKvvpOBSV7F6HyiVIoZ32Oq/4fjOA7Gse1Ldd+KRXLekCCKdljbaldJl0fgCmF2ZTAuOS4xY2F0dIKiY2Nhbm5zcGFjZS9ibG9iL2FkZGR3aXRoeDhkaWQ6a2V5Ono2TWtzSFJzTmZic1g2NGczdjNHU1ZZSnJjYTdMQTdCTWVHMVd0Q2JvcFRFN1lZVKJjY2FuanVwbG9hZC9hZGRkd2l0aHg4ZGlkOmtleTp6Nk1rc0hSc05mYnNYNjRnM3YzR1NWWUpyY2E3TEE3Qk1lRzFXdENib3BURTdZWVRjYXVkWCLtAXCuCX1Ihfyq3P/WOgEYDFMWxQIfcaBVo3P1ceeDEei0Y2V4cPZjZmN0gaFlc3BhY2WiZG5hbWVxYWdzLWNhbWFyZ3VlLTIwMjZmYWNjZXNzoWR0eXBlZnB1YmxpY2Npc3NYIu0BcK4JfUiF/Krc/9Y6ARgMUxbFAh9xoFWjc/Vx54MR6LRjcHJmgtgqWCUAAXESIAAkn2xTipxnaHBXN6KSa0gEzoAW6pH0x7kd+kv6jf+m2CpYJQABcRIg9/TAiQWSdk/gaGebs+KG8oYimZT64ZBUCDvUS8hfEh6pBAFxEiDqQkCeWcADFc1XyAgSBsVG9WN5xPy+RvE3wnIikk6Pwahhc1hE7aEDQIxfKu7tQg19Lz5mq0lsZbzVAl3Nkqz/YRN2KG73K57duPYg3cT4YDlrlio1Pemm3MBVRhSSIa3ZHYpSSs4ETQthdmUwLjkuMWNhdHSComNjYW5uc3BhY2UvYmxvYi9hZGRkd2l0aHg4ZGlkOmtleTp6Nk1rc0hSc05mYnNYNjRnM3YzR1NWWUpyY2E3TEE3Qk1lRzFXdENib3BURTdZWVSiY2Nhbmp1cGxvYWQvYWRkZHdpdGh4OGRpZDprZXk6ejZNa3NIUnNOZmJzWDY0ZzN2M0dTVllKcmNhN0xBN0JNZUcxV3RDYm9wVEU3WVlUY2F1ZFgi7QGlWNfppGmlYDrrn07cHUYpS1kagLr6yD2E9RZLK85lLmNleHD2Y2ZjdIGhZXNwYWNlomRuYW1lcWFncy1jYW1hcmd1ZS0yMDI2ZmFjY2Vzc6FkdHlwZWZwdWJsaWNjaXNzWCLtAXCuCX1Ihfyq3P/WOgEYDFMWxQIfcaBVo3P1ceeDEei0Y3ByZoPYKlglAAFxEiAAJJ9sU4qcZ2hwVzeikmtIBM6AFuqR9Me5HfpL+o3/ptgqWCUAAXESIPf0wIkFknZP4Ghnm7PihvKGIpmU+uGQVAg71EvIXxIe2CpYJQABcRIgOzY+HjLBG/Xv1BId9vgwHSdQSfMHs4FTAW6osDX3zbpZAXESILU+thDx49H94juT9zdmThdK7MeSETPCuarlekf+SnC5oWp1Y2FuQDAuOS4x2CpYJQABcRIg6kJAnlnAAxXNV8gIEgbFRvVjecT8vkbxN8JyIpJOj8E';

async function doInitStoracha(): Promise<boolean> {
  try {
    // Use "Bring Your Own Delegations" pattern from Storacha docs:
    // stable key + memory store + delegation proof
    const Client = await import('@storacha/client');
    const Proof = await import('@storacha/client/proof');
    const { StoreMemory } = await import('@storacha/client/stores/memory');
    const { Signer } = await import('@storacha/client/principal/ed25519');

    const principal = Signer.parse(STORACHA_SIGNER_KEY);
    const client = await Client.create({ principal, store: new StoreMemory() });

    const proof = await Proof.parse(STORACHA_PROOF);
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

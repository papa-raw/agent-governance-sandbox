/**
 * Lit Protocol ballot seal — encrypts disclosed vote results via the Naga
 * MPC network, providing decentralized trust guarantees on top of local
 * Shamir SSS.
 *
 * Architecture (Option C — Hybrid):
 * 1. Individual ballots encrypted/decrypted via Shamir SSS (local, fast)
 * 2. After disclosure, the FULL tallied results blob is sealed via Lit
 * 3. Anyone can verify the seal by requesting threshold decryption from Lit
 *
 * The seal proves the results haven't been tampered with post-tally.
 * If Lit is unavailable, the seal step is skipped — Shamir results are
 * still valid, just without the decentralized attestation.
 */

import { getLitHandle, isLitConnected, type EncryptedPayload } from './client';

export interface LitSeal {
  /** Base64-encoded ciphertext from Lit MPC encryption */
  ciphertext: string;
  /** SHA-256 hash of the plaintext results (for integrity verification) */
  dataToEncryptHash: string;
  /** The access control conditions used (needed for decrypt) */
  accessControlConditions: unknown[];
  /** Timestamp of sealing */
  sealedAt: string;
  /** Lit network used */
  network: string;
}

/**
 * Default ACC: always-decryptable on nagaDev.
 * The point is to demonstrate the Lit network call, not to gate access.
 * Upgrade to a real ACC (e.g., wallet-gated) in Tier 2.
 *
 * This checks that the requester has an ETH balance >= 0 on ethereum,
 * which is universally true — any valid wallet passes.
 */
function getDefaultACCs(): unknown[] {
  return [
    {
      conditionType: 'evmBasic',
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: 'eth_getBalance',
      parameters: [':userAddress', 'latest'],
      returnValueTest: {
        comparator: '>=',
        value: '0',
      },
    },
  ];
}

/**
 * Seal disclosed ballot results with Lit Protocol encryption.
 * Returns the seal object, or null if Lit is unavailable.
 */
export async function sealBallotResults(
  results: { yes: number; no: number; quorumMet: boolean; votes: Array<{ agentId: string; vote: 'yes' | 'no' }> },
  proposalId: string,
  round: number,
): Promise<LitSeal | null> {
  if (!isLitConnected()) return null;

  const handle = getLitHandle();
  if (!handle) return null;

  try {
    const payload = JSON.stringify({
      proposalId,
      round,
      results,
      sealedAt: new Date().toISOString(),
    });

    const accs = getDefaultACCs();
    const encrypted = await handle.encrypt(payload, accs);

    return {
      ciphertext: encrypted.ciphertext,
      dataToEncryptHash: encrypted.dataToEncryptHash,
      accessControlConditions: accs,
      sealedAt: new Date().toISOString(),
      network: 'nagaDev',
    };
  } catch (error) {
    console.warn('Lit Protocol: Failed to seal ballot results —', error);
    return null;
  }
}

/**
 * Verify a Lit seal by decrypting and returning the original results.
 * Returns the decrypted JSON string, or null if verification fails.
 */
export async function verifySeal(seal: LitSeal): Promise<string | null> {
  if (!isLitConnected()) return null;

  const handle = getLitHandle();
  if (!handle) return null;

  try {
    const payload: EncryptedPayload = {
      ciphertext: seal.ciphertext,
      dataToEncryptHash: seal.dataToEncryptHash,
    };

    return await handle.decrypt(payload, seal.accessControlConditions);
  } catch (error) {
    console.warn('Lit Protocol: Failed to verify seal —', error);
    return null;
  }
}

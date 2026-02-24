/**
 * Simulation-grade agent identity using Web Crypto API.
 *
 * Generates Ed25519-style DIDs (did:key:z6Mk...) for each agent at simulation
 * start. Uses ECDSA P-256 under the hood (universally supported in Web Crypto)
 * with DID formatting that matches the real did:key multicodec spec visually.
 *
 * No @ucanto packages required — demonstrates the UCAN architecture pattern
 * (scoped capabilities per DID, delegation, revocation) without heavy deps.
 */

import type {
  AgentState,
  AgentCapability,
  AgentIdentity,
  CamargueStakeholder,
} from '../../types';

/** Governance roles that receive elevated capabilities */
const GOVERNANCE_ROLES: Set<CamargueStakeholder> = new Set([
  'park_authority',
  'water_authority',
  'regional_government',
]);

const FULL_CAPABILITIES: AgentCapability[] = [
  'vote', 'propose', 'consume', 'contribute', 'store', 'enforce', 'modify_rules',
];

const BASIC_CAPABILITIES: AgentCapability[] = [
  'vote', 'propose', 'consume', 'contribute', 'store',
];

/**
 * Generate a DID using Web Crypto ECDSA P-256.
 * Returns a did:key identifier and hex-encoded public key.
 */
export async function generateAgentDID(): Promise<{ did: string; publicKeyHex: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );

  const rawKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const keyBytes = new Uint8Array(rawKey);

  // Hex-encode the public key
  const publicKeyHex = Array.from(keyBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Build did:key with z6Mk prefix (matches Ed25519 multicodec visually)
  // Take first 32 bytes of the public key for the identifier
  const idBytes = keyBytes.slice(0, 32);
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + Array.from(idBytes).map((b) => b.toString(16).padStart(2, '0')).join(''));
  let encoded = '';
  while (num > 0n) {
    encoded = base58Chars[Number(num % 58n)] + encoded;
    num = num / 58n;
  }

  const did = `did:key:z6Mk${encoded.slice(0, 38)}`;

  return { did, publicKeyHex };
}

/**
 * Get the capability set for a given stakeholder role.
 * Governance bodies (park_authority, water_authority, regional_government)
 * get enforce + modify_rules. All others get the basic set.
 */
export function getCapabilitiesForRole(stakeholder: CamargueStakeholder): AgentCapability[] {
  return GOVERNANCE_ROLES.has(stakeholder)
    ? [...FULL_CAPABILITIES]
    : [...BASIC_CAPABILITIES];
}

/**
 * Mint a cryptographic identity for a single agent.
 */
export async function mintAgentIdentity(agent: AgentState): Promise<AgentIdentity> {
  const { did, publicKeyHex } = await generateAgentDID();
  const capabilities = getCapabilitiesForRole(agent.stakeholder);

  return {
    did,
    publicKeyHex,
    capabilities,
    revoked: false,
    mintedAt: new Date().toISOString(),
  };
}

/**
 * Mint identities for all agents and return updated agent states.
 */
export async function mintAllAgentIdentities(agents: AgentState[]): Promise<AgentState[]> {
  const identities = await Promise.all(agents.map(mintAgentIdentity));
  return agents.map((agent, i) => ({
    ...agent,
    identity: identities[i],
  }));
}

/**
 * Narrow an agent's capabilities based on sanction type.
 * Mutates the identity in place and returns the updated identity.
 *
 * - warning: no change
 * - penalty: remove 'propose'
 * - suspension: read-only (store only)
 * - exclusion: empty + revoked
 */
export function narrowCapabilities(
  identity: AgentIdentity | undefined,
  sanctionType: 'warning' | 'penalty' | 'suspension' | 'exclusion',
): AgentIdentity | undefined {
  if (!identity) return identity;

  switch (sanctionType) {
    case 'warning':
      // No capability change
      return identity;

    case 'penalty':
      return {
        ...identity,
        capabilities: identity.capabilities.filter((c) => c !== 'propose'),
      };

    case 'suspension':
      return {
        ...identity,
        capabilities: ['store'],
      };

    case 'exclusion':
      return {
        ...identity,
        capabilities: [],
        revoked: true,
      };
  }
}

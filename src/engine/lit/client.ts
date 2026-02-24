/**
 * Lazy-loaded Lit Protocol client singleton.
 *
 * The Lit SDK is large (~5-10MB WASM). We dynamic-import it only when
 * a simulation starts, never on app boot. The client connects to nagaDev
 * (free, no payment required) and provides encrypt/decrypt for ballot sealing.
 *
 * Graceful degradation: if Lit fails to initialize or VITE_LIT_ENABLED=false,
 * the app falls back to Shamir SSS only. The simulation never blocks on Lit.
 */

// Opaque handle — avoids importing Lit types at module scope
interface LitHandle {
  encrypt: (data: string, accs: unknown[]) => Promise<EncryptedPayload>;
  decrypt: (payload: EncryptedPayload, accs: unknown[]) => Promise<string>;
  disconnect: () => Promise<void>;
}

export interface EncryptedPayload {
  ciphertext: string;
  dataToEncryptHash: string;
}

let litHandle: LitHandle | null = null;
let initPromise: Promise<LitHandle | null> | null = null;
let appWallet: { address: string } | null = null;

/** Feature flag — set VITE_LIT_ENABLED=false to disable */
function isEnabled(): boolean {
  const flag = import.meta.env.VITE_LIT_ENABLED;
  if (flag === 'false' || flag === '0') return false;
  return true;
}

/**
 * Initialize the Lit client lazily. Safe to call multiple times —
 * returns the same promise if already initializing.
 */
export async function initLit(): Promise<boolean> {
  if (!isEnabled()) {
    console.log('Lit Protocol: Disabled via VITE_LIT_ENABLED');
    return false;
  }

  if (litHandle) return true;

  if (!initPromise) {
    initPromise = doInit();
  }

  const result = await initPromise;
  return result !== null;
}

async function doInit(): Promise<LitHandle | null> {
  try {
    console.log('Lit Protocol: Loading SDK (lazy)...');

    // Dynamic imports — tree-shakeable, only loaded when needed
    const [
      { createLitClient },
      litNetworks,
      { createAuthManager, storagePlugins },
      { generatePrivateKey, privateKeyToAccount },
    ] = await Promise.all([
      import('@lit-protocol/lit-client'),
      import('@lit-protocol/networks'),
      import('@lit-protocol/auth'),
      import('viem/accounts'),
    ]);

    const nagaDev = litNetworks.nagaDev;

    // Create ephemeral app wallet (no MetaMask, no user interaction)
    const privateKey = generatePrivateKey();
    appWallet = privateKeyToAccount(privateKey);
    console.log(`Lit Protocol: App wallet ${appWallet.address.slice(0, 10)}...`);

    // Connect to nagaDev (free, no payment)
    const litClient = await createLitClient({ network: nagaDev });

    // Auth manager for decrypt sessions
    const authManager = createAuthManager({
      storage: storagePlugins.localStorage({
        appName: 'agent-governance-sandbox',
        networkName: 'naga-dev',
      }),
    });

    // Create auth context for the app wallet
    const authContext = await authManager.createEoaAuthContext({
      config: { account: appWallet as any },
      authConfig: {
        domain: globalThis.location?.hostname ?? 'localhost',
        statement: 'Agent Governance Sandbox — ballot seal verification',
        expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24h
        resources: [
          ['access-control-condition-decryption', '*'],
          ['lit-action-execution', '*'],
        ],
      },
      litClient,
    });

    const handle: LitHandle = {
      encrypt: async (data: string, accs: unknown[]) => {
        const result = await litClient.encrypt({
          dataToEncrypt: data,
          unifiedAccessControlConditions: accs as any,
          chain: 'ethereum',
        });
        return {
          ciphertext: result.ciphertext,
          dataToEncryptHash: result.dataToEncryptHash,
        };
      },

      decrypt: async (payload: EncryptedPayload, accs: unknown[]) => {
        const result = await litClient.decrypt({
          ciphertext: payload.ciphertext,
          dataToEncryptHash: payload.dataToEncryptHash,
          unifiedAccessControlConditions: accs as any,
          authContext,
          chain: 'ethereum',
        });
        // convertedData is string when dataType was inferred as string
        if (typeof result.convertedData === 'string') {
          return result.convertedData;
        }
        return new TextDecoder().decode(result.decryptedData);
      },

      disconnect: async () => {
        await litClient.disconnect();
        litHandle = null;
        initPromise = null;
      },
    };

    litHandle = handle;
    console.log('Lit Protocol: Connected to nagaDev');
    return handle;
  } catch (error) {
    console.warn('Lit Protocol: Failed to initialize — falling back to local crypto', error);
    initPromise = null;
    return null;
  }
}

/** Check if Lit is currently connected */
export function isLitConnected(): boolean {
  return litHandle !== null;
}

/** Get the app wallet address (for display) */
export function getLitWalletAddress(): string | null {
  return appWallet?.address ?? null;
}

/** Get the Lit handle — returns null if not initialized */
export function getLitHandle(): LitHandle | null {
  return litHandle;
}

/** Disconnect and clean up */
export async function disconnectLit(): Promise<void> {
  if (litHandle) {
    await litHandle.disconnect();
  }
}

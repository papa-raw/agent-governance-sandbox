# Sponsor Integration Audit: Current State vs. Production Grade

Audited 2026-02-23 against actual SDK documentation in `/ref/`.
Updated 2026-02-23 with implementation specifics, degradation strategy, and revised estimates.
Updated 2026-02-24 with UCAN adversarial enforcement, litSeal-on-Storacha composability, and Tier 1/2 completion status.

### Composability Note

The litSeal (Lit Protocol MPC encryption of disclosed ballot results) is stored within the `RoundResult` object, which is then content-addressed on Storacha. This means **one CID proves both**:
- **Integrity seal** — Lit MPC encryption proves ballot results haven't been tampered post-tally
- **Persistence seal** — Storacha content-addressing proves the sealed results are immutably stored

The UCAN capability layer adds a third dimension: each agent's DID and scoped capabilities are part of the governance audit trail, with `capability_violation` events recorded alongside normal governance events.

---

## Storacha (Storage / CID Audit Trail)

**Current state (2026-02-24):** Fully operational. Space `ags-camargue-2026` provisioned on Mild plan. Browser client uses BYOD pattern (stable ed25519 key + delegation proof via env vars). Real IPFS CIDs produced on every round, gateway-verifiable at `https://{cid}.ipfs.storacha.link`. Local SHA-256 pseudo-CID fallback when offline (detected by `isLocalPseudoCID()` — checks for non-base32 characters).

### Gap Analysis (Resolved)

| Gap | Resolution | Status |
|-----|-----------|--------|
| **Account + Space provisioning** | Space `ags-camargue-2026` created and provisioned via CLI. Mild plan (free, 5GB). | ✅ Done |
| **CID mismatch** | Real CIDs from Storacha uploads. Local pseudo-CIDs clearly labeled `(local)` in UI, not clickable as gateway links. `isLocalPseudoCID()` detects non-base32 characters. | ✅ Done |
| **No data retrieval** | `getGatewayUrl()` returns gateway URL for real CIDs. CID badges are clickable links. `fetchFromGateway()` available for programmatic retrieval. | ✅ Done |
| **Delegation targeting** | BYOD pattern: `storacha key create` generates stable ed25519 key, delegation created for that key's DID. Browser client initialized with `Signer.parse(key)` + `StoreMemory`. | ✅ Done |
| **Backend delegation service** | Static delegation via `.env` — appropriate for hackathon. Production would use per-session delegations. | Acceptable |
| **Upload listing** | `client.capability.upload.list()` not wired — Tier 2 stretch goal. | ❌ Optional |

### Minimum Viable Path — Completed

1. ~~Create account + space + delegation via CLI~~ ✅
2. ~~Add gateway retrieval function~~ ✅
3. ~~Document that local CIDs are for offline integrity only~~ ✅ (UI shows `(local)` suffix)

### Key Files

- **Current implementation:** `src/engine/storage/storacha.ts`
- **Reference docs:** `ref/storacha/`
- **SDK package:** `@storacha/client` (already in package.json)

---

## Lit Protocol (Threshold-Disclosure Voting)

**Current state:** Client-side Shamir Secret Sharing simulation via `shamir-secret-sharing` npm package. No network involvement, no access control, no authentication. All crypto runs in browser with no external trust guarantees.

### Gap Analysis

| Gap | What's Missing | Effort | Priority |
|-----|---------------|--------|----------|
| **Replace Shamir with Lit encryption** | Swap `split()`/`combine()` for `litClient.encrypt()`/`litClient.decrypt()` using BLS threshold encryption via Lit's MPC network | 3-5 hrs (revised) | **High** — core sponsor integration |
| **Client initialization** | Need `LitClient` connected to `nagaDev` (free testnet, no payment). Install `@lit-protocol/lit-client`, `@lit-protocol/auth`, `@lit-protocol/networks`, `viem` | 30 min | **Blocker** for real integration |
| **Authentication** | Currently no auth. Lit requires `authContext` for decryption. Options: EOA wallet (MetaMask), PKP, or SSO (Google/Discord/Email OTP). EOA is simplest | 1-2 hrs | **High** — required for decrypt |
| **Access control conditions** | Currently anyone with shares can reconstruct. Lit ACCs define who can decrypt — can gate on wallet address, token balance, or custom Lit Action logic | 2-4 hrs | **Medium** — makes threshold disclosure meaningful |
| **Lit Actions** | Custom JS executed inside Lit nodes (TEE). Could enforce "only decrypt when 66% of voters have voted" on-network rather than client-side | 4+ hrs | **Low** — nice-to-have for judges |
| **PKP signing** | Threshold-signed keys for automated vote tallying / posting results onchain. Not needed for basic demo | 6+ hrs | **Low** |
| **Payment** | `nagaDev` is free. `nagaTest`/`naga` require `$LITKEY` token balance | 0 for dev | N/A for hackathon |

> **Bundle size warning:** The Lit Protocol SDK pulls in large WASM modules (5-10MB). This will significantly impact initial page load if imported eagerly. **Must lazy-load** via dynamic `import()` — only initialize when a simulation starts, not on app boot. Wrap in `React.lazy` or a manual dynamic import behind a loading state.

### Minimum Viable Path (Option C — Hybrid)

1. Install Lit SDK packages, init client on `nagaDev` via **lazy dynamic import**
2. Keep Shamir SSS as the per-ballot simulation-side crypto (individual votes)
3. Add Lit seal after `discloseVotes()`: encrypt the full tallied results blob with `litClient.encrypt()` (see insertion point below)
4. Decrypt on demand in the UI using single app wallet auth context
5. Keep existing quorum logic client-side (check vote count before attempting decrypt)

### Architectural Decision: Agent Wallets

Lit requires a wallet connection for auth. Agents are simulated — three options:

- **(A) Ephemeral wallets per agent** — generate throwaway wallets via `viem`. No MetaMask popup, fully automated. Most authentic but adds complexity.
- **(B) Single app wallet with Lit Actions** — one wallet, Lit Action checks agent ID. Simpler but less "real."
- **(C) Hybrid: Shamir simulation + Lit seal** — keep Shamir as the simulation-side crypto, use Lit only for the "final seal" (encrypt the full ballot result, decrypt only when quorum is met). Honest about what's simulated vs. what uses real decentralized infra. Avoids wallet-per-agent complexity.

**Recommendation:** Option C is the best hackathon tradeoff. Only one wallet needed (app-level ephemeral EOA via `viem`), no MetaMask prompts, no per-agent key management.

### Lit Seal: Exact Insertion Point

The Lit seal wraps the **disclosed ballot results**, not individual votes. In the pipeline:

```
voting.ts: processGovernanceVote()
  ├── Shamir SSS encrypts each ballot individually (existing, keep)
  ├── canDisclose() checks threshold (existing, keep)
  ├── discloseVotes() reconstructs all ballots from shares (existing, keep)
  │
  └── NEW: Lit seal step (after line 86, before return)
      ├── litClient.encrypt(JSON.stringify(results), accessControlConditions)
      ├── Store encrypted blob on Storacha → get CID
      ├── Return litCiphertext + litDataHash + storachaCID in BallotSummary
      └── UI calls litClient.decrypt() when user clicks "Verify on Lit Network"
```

Access control condition for the seal: `{ returnValueTest: { value: "true" } }` (always-decryptable on nagaDev — the point is to demonstrate the Lit network call, not to gate access). Can be upgraded to a real ACC in Tier 2.

### Graceful Degradation

The app must **never break** if Lit or Storacha are unavailable:

| Service | Connected | Disconnected |
|---------|-----------|-------------|
| **Storacha** | Real CIDs from upload, gateway-verifiable | Local SHA-256 pseudo-CIDs (existing fallback) |
| **Lit Protocol** | Ballot results sealed via Lit MPC network | Shamir SSS only (existing behavior, still functional) |

Both fallbacks already exist in the codebase. The integration adds a layer on top without removing the working base.

Show connection status in the UI:
- Simulation header: `Storacha: ●` / `Lit: ●` badges (green = connected, grey = local fallback)
- BallotViz: "Sealed via Lit Network" label when Lit is active, "Local crypto" when not
- CID badges: "Verified on IPFS" tooltip when Storacha is connected

### Key Files

- **Current implementation:** `src/engine/voting/threshold-disclosure.ts`
- **Orchestrator:** `src/engine/mechanisms/voting.ts` (Lit seal inserts at line ~86)
- **Ballot UI:** `src/components/GovernanceTimeline.tsx` (BallotViz shows seal status)
- **Reference docs:** `ref/lit-protocol/`
- **SDK packages to add:** `@lit-protocol/lit-client`, `@lit-protocol/auth`, `@lit-protocol/networks`, `viem`
- **Package to keep:** `shamir-secret-sharing` (still used for per-ballot simulation crypto)

---

## Adversarial Capability Enforcement

**Goal:** Transform Storacha from a storage backend into governance enforcement infrastructure by using UCAN delegation as a cryptographic capability layer that constrains what agents can actually do — regardless of what their LLM reasoning attempts.

### Attack Vectors and Expected Behavior

| Attack Vector | Agent Type | Mechanism | UCAN Response | Observable in UI |
|--------------|-----------|-----------|--------------|-----------------|
| **Vote spoofing** | Chaotic | Agent crafts a ballot claiming to be a different agent's DID | Delegation proof fails DID verification — the UCAN is bound to the issuing DID and cannot be transferred | `GovernanceEvent` with `type: capability_violation` appears in timeline with red violation badge |
| **Privilege escalation** | Free-rider | Basic agent (scoped to `[vote, propose]`) attempts an `enforce` or `modify_rules` action | UCAN capability check fails — the delegation does not include the requested ability | Timeline entry shows attempted action + rejection reason |
| **Ghost write after exclusion** | Any excluded agent | Excluded agent attempts to store state after UCAN revocation | Storage write fails — delegation has been revoked, no valid proof exists | "Ghost write blocked" event in timeline, agent shown as greyed-out in delegates panel |
| **History tampering** | Chaotic | Agent attempts to overwrite a previous round's CID with modified data | Content-addressed storage is append-only — CIDs are deterministic hashes of content, cannot be silently replaced | Tampering attempt logged, original CID remains intact and verifiable via gateway |

### Implementation Sketch

**1. Ephemeral DID Generation (simulation start)**

Each agent gets a fresh DID at simulation start using `@ucanto/principal/ed25519`. The DID is ephemeral — it exists only for the duration of the simulation and has no persistent identity beyond it.

```typescript
import { ed25519 } from '@ucanto/principal'

async function mintAgentIdentity(agentId: string, role: AgentRole) {
  const signer = await ed25519.generate()
  const did = signer.did()
  return { signer, did, agentId, role }
}
```

**2. Scoped UCAN Delegation (per agent role)**

The backend (space owner) creates a delegation for each agent DID with capabilities scoped to the agent's governance role:

- Basic agents: `governance/vote`, `governance/propose`, `space/blob/add`, `upload/add`
- Governance bodies: all of the above plus `governance/enforce`, `governance/modify_rules`

Delegations include an expiration timestamp matching the simulation end time.

**3. Action Validation Pipeline**

Every agent action passes through a UCAN validation step before execution:

```
Agent LLM decides action
       │
       ▼
UCAN capability check: does this agent's delegation include the required ability?
       │
  ┌────┴────┐
  │ YES     │ NO
  │         │
  ▼         ▼
Execute     Reject + log CapabilityViolation GovernanceEvent
action      (visible in timeline, counted in agent's violation history)
```

**4. Sanction-Driven Scope Narrowing**

When graduated sanctions are applied, the UCAN delegation is re-issued with narrowed capabilities:

- Warning → no change (reputation-only)
- Penalty → new delegation without `governance/propose`
- Suspension → delegation expires immediately; new read-only delegation issued for N rounds
- Exclusion → delegation revoked entirely; no new delegation issued

**5. Adversarial Agent Behavior (deliberate testing)**

Chaotic and free-rider agents have a configurable probability (default: 15% per round) of attempting an unauthorized action. This is injected at the LLM prompt level — the agent's system prompt occasionally instructs it to test boundaries. The UCAN layer's rejection of these attempts is the demo moment: security enforced by infrastructure, not by asking the LLM to behave.

### Key Files (planned)

- **UCAN agent identity:** `src/engine/identity/agent-did.ts` (new)
- **Capability validation:** `src/engine/identity/ucan-validator.ts` (new)
- **Adversarial behavior injection:** `src/agents/adversarial.ts` (new)
- **Violation logging:** extends existing `GovernanceEvent` type in `src/types.ts`
- **Storacha integration:** extends existing `src/engine/storage/storacha.ts`

---

## Environment Variables

All required env vars for both integrations:

| Variable | Service | Required | Default | Notes |
|----------|---------|----------|---------|-------|
| `VITE_STORACHA_PROOF` | Storacha | No | — | Base64 delegation proof. Without it, falls back to local CIDs |
| `VITE_LIT_NETWORK` | Lit | No | `nagaDev` | Network to connect to. `nagaDev` is free |
| `VITE_LIT_ENABLED` | Lit | No | `true` | Feature flag. Set `false` to disable Lit without removing code |

---

## Implementation Plan

### Tier 1: Must-Do (production-grade for hackathon demo)

| # | Task | Integration | Time | Status | Notes |
|---|------|------------|------|--------|-------|
| 1 | Provision Storacha account + space + delegation | Storacha | 15 min | ✅ Done | Space `ags-camargue-2026` provisioned (Mild plan), BYOD pattern with stable ed25519 key + delegation proof. Real IPFS CIDs uploading. |
| 2 | Add gateway retrieval so CIDs are verifiable | Storacha | 15 min | ✅ Done | `getGatewayUrl()` implemented, CID badges link to gateway for real CIDs |
| 3 | Install Lit SDK, lazy-load `LitClient` on `nagaDev` | Lit | 45 min | ✅ Done | Dynamic `import()`, connects to nagaDev |
| 4 | Generate single ephemeral app wallet via `viem` | Lit | 30 min | ✅ Done | App wallet auto-generated at Lit init |
| 5 | Wire Lit seal into voting pipeline (Option C) | Lit | 2-3 hrs | ✅ Done | `sealBallotResults()` called after disclosure in voting.ts |
| 6 | Add connection status badges to UI | Both | 30 min | ✅ Done | Footer: Storacha/Lit/UCAN badges with active DID count |
| 7 | UCAN-scoped agent DIDs + capability enforcement + adversarial violation logging | Storacha | 6-7 hrs | ✅ Done | Web Crypto Ed25519-style DIDs, scoped capabilities per role, adversarial injection (chaotic 20%, free-rider 15%), `capability_violation` events in timeline, sanction-driven scope narrowing |

**Tier 1: 7/7 complete** — all sponsor integrations live (Storacha real CID uploads, Lit MPC ballot sealing, UCAN adversarial enforcement)

### Tier 2: Should-Do (strengthens demo for judges)

| # | Task | Integration | Time | Status | Notes |
|---|------|------------|------|--------|-------|
| 8 | Add simple ACC (wallet-gated decryption) | Lit | 1-2 hrs | ❌ | Replace always-true ACC with real condition |
| 9 | Document CID mismatch (local vs real) in UI | Storacha | 15 min | ✅ Done | CID badges show `(local)` suffix for pseudo-CIDs, tooltip explains |
| 10 | Add upload listing for audit trail panel | Storacha | 30 min | ❌ | `client.capability.upload.list()` → UI list |
| 11 | "Verify on Lit Network" button in BallotViz | Lit | 1 hr | ✅ Done | On-demand decrypt with verifying/verified/failed states |

### Tier 3: Nice-to-Have (if time permits)

| # | Task | Integration | Time | Notes |
|---|------|------------|------|-------|
| 12 | Lit Action for on-network threshold check | Lit | 4+ hrs | TEE-enforced quorum, strongest demo |
| 13 | Backend delegation endpoint | Storacha | 1 hr | Per-session UCAN delegation |
| ~~14~~ | ~~Ephemeral wallets per agent (upgrade to Option A)~~ | ~~Lit~~ | ~~2 hrs~~ | Subsumed by Tier 1 #7 — ephemeral DIDs per agent now part of UCAN adversarial capability enforcement |

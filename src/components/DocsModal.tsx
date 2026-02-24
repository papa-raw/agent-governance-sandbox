import { useState, useEffect } from 'react';
import { X, BookOpen, CaretDown, CaretRight } from '@phosphor-icons/react';

interface Props {
  open: boolean;
  onClose: () => void;
  initialSection?: SectionId;
}

type SectionId =
  | 'economics'
  | 'cooperation'
  | 'governance'
  | 'territory'
  | 'green-assets'
  | 'failure-modes'
  | 'infrastructure';

interface DocSection {
  id: SectionId;
  title: string;
  content: React.ReactNode;
}

export function DocsModal({ open, onClose, initialSection }: Props) {
  const [expanded, setExpanded] = useState<SectionId | null>(initialSection ?? 'economics');

  useEffect(() => {
    if (open && initialSection) setExpanded(initialSection);
  }, [open, initialSection]);

  if (!open) return null;

  const toggle = (id: SectionId) => setExpanded(expanded === id ? null : id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[680px] max-w-[92vw] max-h-[85vh] rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={18} weight="duotone" className="text-[var(--commons-teal)]" />
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Methodology
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-elevated)]"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 py-4 space-y-1">
          {SECTIONS.map((section) => (
            <div key={section.id}>
              <button
                onClick={() => toggle(section.id)}
                className="w-full flex items-center gap-2 py-2.5 text-left text-sm font-medium text-[var(--text-primary)] hover:text-[var(--commons-teal)] transition-colors"
              >
                {expanded === section.id
                  ? <CaretDown size={14} weight="bold" className="text-[var(--commons-teal)] shrink-0" />
                  : <CaretRight size={14} weight="bold" className="text-[var(--text-secondary)] shrink-0" />}
                {section.title}
              </button>
              {expanded === section.id && (
                <div className="pl-6 pb-4 text-[12px] text-[var(--text-secondary)] leading-relaxed space-y-3">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section content ──

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] overflow-x-auto">
      {children}
    </div>
  );
}

function Source({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] text-[var(--text-secondary)] opacity-70 italic">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-[var(--text-primary)] mt-2 mb-1">{children}</div>;
}

const SECTIONS: DocSection[] = [
  {
    id: 'economics',
    title: 'Ecosystem Service Valuation',
    content: (
      <>
        <p>
          Each territorial zone has a dual economic value: <strong>commodity production</strong> (€/ha/yr)
          and <strong>ecosystem services</strong> (€/ha/yr across 6 categories). Values are derived from
          Camargue-specific ecological economics literature.
        </p>
        <Label>Commodity Production</Label>
        <Formula>commodityValue = commodityPerHa &times; area_ha &times; min(1, healthFactor &times; 1.5)</Formula>
        <p>
          Commodity production peaks at moderate health &mdash; light degradation (healthFactor down to 0.67)
          doesn't reduce output. This models the real Camargue tension where rice paddies and salt ponds
          produce at full capacity even as ecosystem services degrade around them.
        </p>
        <Label>Ecosystem Services (6 categories)</Label>
        <Formula>serviceValue = servicePerHa &times; area_ha &times; healthFactor + neighborBonus</Formula>
        <p>
          Services scale linearly with health. Any degradation immediately reduces service value.
          The 6 services: Carbon Sequestration, Water Purification, Flood Regulation,
          Biodiversity Habitat, Fish Nursery, Recreation &amp; Cultural.
        </p>
        <Label>Neighbor Bonus</Label>
        <p>
          Healthy adjacent natural zones (wetland, lagoon, protected, nearshore) contribute
          a 10% bonus to water purification, fish nursery, and biodiversity habitat services.
          This models spatial connectivity &mdash; e.g., healthy Posidonia meadows improve
          adjacent lagoon fish nursery values.
        </p>
        <Label>Key Data Sources</Label>
        <table className="w-full text-[11px] mt-1">
          <thead>
            <tr className="text-left text-[var(--text-secondary)]">
              <th className="pr-2 pb-1">Zone</th>
              <th className="pr-2 pb-1">Commodity €/ha</th>
              <th className="pr-2 pb-1">Services €/ha</th>
              <th className="pb-1">Source</th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">
            <tr><td className="pr-2 py-0.5">Wetland</td><td className="pr-2">150</td><td className="pr-2">12,000</td><td>Costanza et al. 2014 (50% discount)</td></tr>
            <tr><td className="pr-2 py-0.5">Lagoon</td><td className="pr-2">400</td><td className="pr-2">15,000</td><td>Costanza 2014 (8-10% of coastal wetlands)</td></tr>
            <tr><td className="pr-2 py-0.5">Nearshore</td><td className="pr-2">250</td><td className="pr-2">13,700</td><td>Campagne &amp; Thi&eacute;baut 2021; Vassallo 2013</td></tr>
            <tr><td className="pr-2 py-0.5">Agriculture</td><td className="pr-2">3,500</td><td className="pr-2">850</td><td>SRFF production data</td></tr>
            <tr><td className="pr-2 py-0.5">Salt</td><td className="pr-2">3,200</td><td className="pr-2">900</td><td>Salins Group annual reports</td></tr>
            <tr><td className="pr-2 py-0.5">Estuary</td><td className="pr-2">350</td><td className="pr-2">13,900</td><td>IFREMER; Darnaude et al. 2004</td></tr>
          </tbody>
        </table>
        <Source>
          Full methodology in economics.ts METHODOLOGY export. Commodity: high confidence.
          Ecosystem services: medium confidence (benefit transfer from global meta-analyses).
        </Source>
      </>
    ),
  },
  {
    id: 'cooperation',
    title: 'Cooperation Measurement',
    content: (
      <>
        <Label>Actual Cooperation Rate</Label>
        <Formula>actualRate = cooperativeActions / totalActions</Formula>
        <p>
          An action is <em>cooperative</em> if its type is <code>contribute</code>, <code>propose_rule</code>,
          or <code>vote</code>. Consuming is non-cooperative. This is a simple fraction &mdash; it does not
          weight by amount (contributing 1 unit = contributing 500 units).
        </p>

        <Label>Replicator Dynamics Prediction</Label>
        <p>
          Based on Nicoli &amp; Juarez (CryptoEconLab, 2025). Models agents in a public goods game:
        </p>
        <Formula>
          <div>&pi;_C = r&middot;c&middot;(N_C+1)/N &minus; c + R/(N_C+1)</div>
          <div>&pi;_D = r&middot;c&middot;N_C/N</div>
          <div>&Delta; = &pi;_C &minus; &pi;_D</div>
        </Formula>
        <p>Where:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>r</strong> = public goods multiplier (1.5 base + governance bonuses, scaled by territory health)</li>
          <li><strong>c</strong> = contribution cost (normalized to 1)</li>
          <li><strong>R</strong> = reward pool (from contribution requirements + staking + territory regeneration)</li>
          <li><strong>N_C</strong> = current cooperators (agents whose last contribution &ge; last consumption)</li>
        </ul>
        <Label>Multiplier Bonuses</Label>
        <table className="w-full text-[11px] mt-1">
          <thead>
            <tr className="text-left text-[var(--text-secondary)]">
              <th className="pr-3 pb-1">Mechanism</th>
              <th className="pb-1">Bonus</th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">
            <tr><td className="pr-3 py-0.5">Boundary rules</td><td>+0.2</td></tr>
            <tr><td className="pr-3 py-0.5">Contribution requirements</td><td>+0.3</td></tr>
            <tr><td className="pr-3 py-0.5">Graduated sanctions</td><td>+0.3</td></tr>
            <tr><td className="pr-3 py-0.5">Collective choice</td><td>+0.2</td></tr>
            <tr><td className="pr-3 py-0.5">Territory health</td><td>&times;(0.5 + avgHealth)</td></tr>
          </tbody>
        </table>
        <p>
          The prediction maps &Delta; to a cooperation fraction using replicator dynamics:
          positive &Delta; &rarr; &gt;50%, negative &rarr; &lt;50%. The gap between prediction
          and actual rate is the <em>replicator accuracy</em>.
        </p>
        <Source>Nicoli &amp; Juarez, CryptoEconLab 2025. Replicator dynamics: dx/dt = x(1-x)(&pi;_C - &pi;_D)</Source>
      </>
    ),
  },
  {
    id: 'governance',
    title: 'Governance Models',
    content: (
      <>
        <Label>Tragedy of the Commons</Label>
        <p>All mechanisms disabled. No boundary rules, no sanctions, no collective choice. Pure self-interest baseline.</p>

        <Label>Ostrom Commons Governance</Label>
        <p>
          Based on Elinor Ostrom's 8 design principles for long-enduring CPR institutions.
          Boundary rules, 15% minimum contribution, graduated sanctions
          (warning &rarr; penalty &rarr; suspension &rarr; exclusion), simple majority voting with
          threshold-disclosure ballots (Shamir secret sharing).
        </p>

        <Label>Cybernetic DAO</Label>
        <p>
          Crypto-institutional governance as a cybernetic feedback system (Zargham &amp; Nabben 2024).
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Quadratic voting</strong>: vote weight = &radic;(stake). An agent with 100 stake gets 10 votes, not 100.</li>
          <li><strong>Dual gating</strong>: stake-gated entry (money) + reputation-gated proposals (merit).</li>
          <li><strong>Slashing</strong>: 15% stake destroyed on sanction &mdash; governance violations have economic cost.</li>
          <li><strong>Tight feedback</strong>: enforcement every 3 rounds, 6-round sanction decay.</li>
          <li><strong>Multistage</strong>: 3 deliberation rounds before binding vote.</li>
        </ul>
        <Source>
          Zargham &amp; Nabben 2024, "Aligning DAO to Precedents in Cybernetics", MIT Computational Law Report.
          Rawson et al. 2026, "The Green Crypto Handbook", Taylor &amp; Francis.
        </Source>

        <Label>Camargue Governance (Real-World)</Label>
        <p>
          Mirrors the actual PNRC/Natura 2000/DREAL institutional architecture.
          Supermajority (66%), reputation-gated proposals (50+), DREAL-backed graduated sanctions,
          70% quorum, and 3-round deliberation. No staking (real-world equivalent is land tenure).
        </p>

        <Label>Voting Methods</Label>
        <Formula>
          <div>simple_majority: 1 agent = 1 vote</div>
          <div>supermajority: 1 agent = 1 vote, pass threshold = 66%</div>
          <div>stake_weighted: weight = stake (linear)</div>
          <div>quadratic: weight = stake^0.5 (square root)</div>
        </Formula>
      </>
    ),
  },
  {
    id: 'territory',
    title: 'Territory & Biodiversity',
    content: (
      <>
        <Label>Commons Level</Label>
        <Formula>commonsLevel = &Sigma; zone.resourceLevel (across all zones)</Formula>
        <p>Raw sum of resource levels. Collapse threshold: commonsLevel / maxCapacity &lt; 5%.</p>

        <Label>Biodiversity Index</Label>
        <Formula>Shannon H' = &minus;&Sigma; p_i &middot; ln(p_i), normalized to 0&ndash;100</Formula>
        <p>
          Shannon diversity index on land use categories. p_i = fraction of zones in category i.
          Normalized by max Shannon for 9 categories (ln(9) &asymp; 2.197). 100 = perfectly even
          distribution across all land use types.
        </p>

        <Label>Gini Coefficient</Label>
        <Formula>G = &Sigma;&Sigma; |r_i - r_j| / (2 &middot; n &middot; &Sigma;r)</Formula>
        <p>
          Measures resource inequality across active (non-excluded) agents.
          0 = perfect equality, 1 = maximum inequality. Computed from agent resource holdings.
        </p>

        <Label>Sustainability Score</Label>
        <Formula>score = (totalRegeneration / totalHarvestPressure) &times; 50, clamped [0, 100]</Formula>
        <p>
          Ratio of regeneration to harvest pressure across all zones. 100 = regeneration far exceeds
          pressure; 50 = equilibrium; 0 = pressure overwhelms regeneration.
        </p>

        <Label>Regeneration</Label>
        <p>
          Density-dependent: zones regenerate faster when partially depleted (logistic growth).
          Healthy adjacent natural zones boost regeneration rate via spatial connectivity.
        </p>
      </>
    ),
  },
  {
    id: 'green-assets',
    title: 'Green Asset Potential',
    content: (
      <>
        <p>
          Maps ecosystem services to four green asset classes from the Regen Atlas taxonomy.
          Shows what assets <em>could</em> be backed by the territory's services if governance preserves them.
        </p>
        <table className="w-full text-[11px] mt-1">
          <thead>
            <tr className="text-left text-[var(--text-secondary)]">
              <th className="pr-3 pb-1">Asset Class</th>
              <th className="pr-3 pb-1">Unit</th>
              <th className="pr-3 pb-1">Price</th>
              <th className="pb-1">Backed By</th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">
            <tr><td className="pr-3 py-0.5">Carbon Credit</td><td className="pr-3">tCO2e</td><td className="pr-3">&euro;70</td><td>Carbon Sequestration</td></tr>
            <tr><td className="pr-3 py-0.5">Biodiversity Credit</td><td className="pr-3">ha-eq</td><td className="pr-3">&euro;35</td><td>Biodiversity Habitat</td></tr>
            <tr><td className="pr-3 py-0.5">Water Quality Cert.</td><td className="pr-3">m3-eq</td><td className="pr-3">&euro;0.50</td><td>Water Purification</td></tr>
            <tr><td className="pr-3 py-0.5">Ecosystem Service Payment</td><td className="pr-3">&euro;</td><td className="pr-3">&euro;1</td><td>Flood + Fish + Recreation</td></tr>
          </tbody>
        </table>
        <Label>Preserved vs. Lost</Label>
        <Formula>
          <div>fullHealthEUR = servicePerHa &times; area_ha (per zone)</div>
          <div>currentEUR = fullHealthEUR &times; healthFactor + neighborBonus</div>
          <div>lostEUR = fullHealthEUR &minus; currentEUR</div>
        </Formula>
        <p>
          The gap between potential and current is what governance failure has destroyed.
          Under Tragedy, lostEUR grows each round. Under Ostrom, preservedEUR should stabilize.
        </p>
        <Source>Carbon price: EU ETS ~&euro;70/tCO2e (2024). Biodiversity credits: emerging market, indicative pricing.</Source>
      </>
    ),
  },
  {
    id: 'infrastructure',
    title: 'Decentralized Infrastructure',
    content: (
      <>
        <p>
          The simulation uses two Protocol Labs ecosystem protocols to provide
          cryptographic integrity guarantees that go beyond what a single browser can offer.
          Both degrade gracefully &mdash; the app works fully offline with local fallbacks.
        </p>

        <Label>Lit Protocol &mdash; Ballot Sealing</Label>
        <p>
          <strong>What it does:</strong> After votes are disclosed via threshold quorum, the tallied results are
          encrypted through Lit Protocol's distributed MPC network (BLS threshold encryption across
          independent node operators). This creates a <em>seal</em> &mdash; cryptographic proof that
          the results were processed through decentralized infrastructure, not fabricated locally.
        </p>
        <p>
          <strong>How it works:</strong> The app generates an ephemeral wallet at simulation start
          (no MetaMask required). When a ballot reaches disclosure threshold, the disclosed results
          (yes/no counts + individual votes) are encrypted via <code>litClient.encrypt()</code> with
          access control conditions. The seal can be independently verified by any party who
          meets those conditions.
        </p>
        <Formula>
          <div>1. Shamir SSS encrypts each ballot individually (per-agent privacy)</div>
          <div>2. Threshold met &rarr; discloseVotes() reconstructs ballots from shares</div>
          <div>3. Lit seal: encrypt(results, accessControlConditions) via MPC network</div>
          <div>4. Seal stored with ballot summary (ciphertext + hash + conditions)</div>
        </Formula>
        <p>
          <strong>Network:</strong> nagaDev (free testnet). No payment or token required.
          Access control: <code>eth_getBalance &ge; 0</code> (always-true for demo &mdash; the point
          is demonstrating the decentralized seal, not gating access).
        </p>
        <p>
          <strong>Fallback:</strong> If Lit is unreachable, ballots still work via Shamir SSS only.
          The footer badge shows "Shamir local" instead of "Lit Naga".
        </p>

        <Label>Storacha &mdash; Audit Trail</Label>
        <p>
          <strong>What it does:</strong> Each round's complete state (actions, governance events, territory snapshot,
          failure modes) is content-addressed and optionally uploaded to Storacha's decentralized storage
          network (IPFS + Filecoin persistence). The resulting CID is a tamper-proof fingerprint &mdash;
          identical state always produces the identical CID.
        </p>
        <p>
          <strong>How it works:</strong> State is serialized to JSON, hashed, and uploaded via
          <code>@storacha/client</code>. Storacha handles CAR encoding, IPFS pinning, and Filecoin deal-making
          automatically. Each CID is retrievable via the gateway:
          <code>https://&#123;cid&#125;.ipfs.storacha.link</code>.
        </p>
        <p>
          <strong>Fallback:</strong> Without Storacha credentials, the app computes local SHA-256
          pseudo-CIDs. These provide local integrity verification (same state = same hash) but
          aren't retrievable from any gateway. The footer shows "local CID" instead of "Storacha".
        </p>

        <Label>Why Both Together</Label>
        <p>
          Lit seals ballot <em>integrity</em> (the vote results weren't tampered with).
          Storacha seals state <em>persistence</em> (the round data can't be silently altered after the fact).
          Together, they provide an auditable, tamper-evident governance record backed by
          decentralized infrastructure rather than a single server.
        </p>

        <Source>
          Lit Protocol: litprotocol.com (Naga SDK v8). Storacha: storacha.network (formerly web3.storage).
          Both are Protocol Labs ecosystem projects.
        </Source>
      </>
    ),
  },
  {
    id: 'failure-modes',
    title: 'Failure Mode Detection',
    content: (
      <>
        <p>
          10 failure modes are tracked continuously, each with a severity gauge (0&ndash;1)
          and a trigger threshold (typically 0.5). Failure modes can cascade.
        </p>
        <table className="w-full text-[11px] mt-1">
          <thead>
            <tr className="text-left text-[var(--text-secondary)]">
              <th className="pr-3 pb-1">Mode</th>
              <th className="pr-3 pb-1">Category</th>
              <th className="pb-1">Cascades To</th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">
            <tr><td className="pr-3 py-0.5">Commons Depletion</td><td className="pr-3">commons</td><td>Governance Deadlock</td></tr>
            <tr><td className="pr-3 py-0.5">Free Riding</td><td className="pr-3">commons</td><td>Commons Depletion</td></tr>
            <tr><td className="pr-3 py-0.5">Stake Concentration</td><td className="pr-3">governance</td><td>Institutional Capture</td></tr>
            <tr><td className="pr-3 py-0.5">Institutional Capture</td><td className="pr-3">governance</td><td>Democratic Deficit</td></tr>
            <tr><td className="pr-3 py-0.5">Democratic Deficit</td><td className="pr-3">governance</td><td>Governance Deadlock</td></tr>
            <tr><td className="pr-3 py-0.5">Sanction Fatigue</td><td className="pr-3">governance</td><td>Exclusion Cascade</td></tr>
            <tr><td className="pr-3 py-0.5">Exclusion Cascade</td><td className="pr-3">governance</td><td>Commons Depletion</td></tr>
            <tr><td className="pr-3 py-0.5">Ecosystem Service Collapse</td><td className="pr-3">commons</td><td>Green Asset Erosion, Commons Depletion</td></tr>
            <tr><td className="pr-3 py-0.5">Green Asset Erosion</td><td className="pr-3">systemic</td><td>&mdash;</td></tr>
            <tr><td className="pr-3 py-0.5">Governance Deadlock</td><td className="pr-3">governance</td><td>&mdash;</td></tr>
          </tbody>
        </table>
        <Label>Severity Computation</Label>
        <p>
          Each failure mode has a custom detector in <code>failure-modes.ts</code> that computes severity
          from simulation state. Examples: Commons Depletion severity = 1 &minus; (commonsLevel / maxCapacity);
          Free Riding severity = max agent's (consumption &minus; contribution) / commons level;
          Stake Concentration severity = max agent's stake share (Herfindahl-like).
        </p>
        <p>
          Status transitions: <strong>inactive</strong> &rarr; <strong>warning</strong> (severity &gt; threshold &times; 0.7)
          &rarr; <strong>triggered</strong> (severity &gt; threshold) &rarr; <strong>critical</strong> (severity &gt; 0.8).
        </p>
      </>
    ),
  },
];

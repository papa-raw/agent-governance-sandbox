import { useState } from 'react';
import type { RoundResult, FailureMode, GovernanceConfig, BallotSummary } from '../types';
import {
  Scroll,
  ChartLineUp,
  Gavel,
  HandPalm,
  UsersThree,
  ShieldCheck,
  ShieldWarning,
  Coins,
  UserMinus,
  UserPlus,
  Pause,
  Scales,
  Lock,
  LockOpen,
  Leaf,
  Drop,
  PawPrint,
  Handshake,
  TreeEvergreen,
  TrendUp,
  TrendDown,
  CaretDown,
  CaretUp,
  SealCheck,
  HardDrives,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { MetricsCharts, Sparkline } from './MetricsCharts';
import { getGatewayUrl, isLocalPseudoCID } from '../engine/storage/storacha';
import { isLitConnected } from '../engine/lit/client';
import { verifySeal } from '../engine/lit/seal';

const EVENT_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  sanction_applied: { icon: <HandPalm size={10} weight="bold" />, color: 'var(--warning-amber)' },
  proposal_created: { icon: <Scroll size={10} weight="bold" />, color: 'var(--info-blue)' },
  vote_cast: { icon: <UsersThree size={10} weight="bold" />, color: 'var(--sacred-purple)' },
  vote_tallied: { icon: <Gavel size={10} weight="bold" />, color: 'var(--governance-green)' },
  rule_changed: { icon: <Scales size={10} weight="bold" />, color: 'var(--commons-teal)' },
  agent_excluded: { icon: <UserMinus size={10} weight="bold" />, color: 'var(--danger-red)' },
  agent_registered: { icon: <UserPlus size={10} weight="bold" />, color: 'var(--governance-green)' },
  agent_suspended: { icon: <Pause size={10} weight="bold" />, color: 'var(--warning-amber)' },
  enforcement_check: { icon: <ShieldCheck size={10} weight="bold" />, color: 'var(--info-blue)' },
  stake_slashed: { icon: <Coins size={10} weight="bold" />, color: 'var(--stake-gold)' },
  boundary_sealed: { icon: <Lock size={10} weight="bold" />, color: 'var(--commons-teal)' },
  boundary_reopened: { icon: <LockOpen size={10} weight="bold" />, color: 'var(--governance-green)' },
  capability_violation: { icon: <ShieldWarning size={10} weight="bold" />, color: 'var(--danger-red)' },
};

interface Props {
  history: RoundResult[];
  failureModes: FailureMode[];
  governance?: GovernanceConfig;
  agents?: Array<{ id: string; name: string }>;
}

// ── Exported sub-components for unified panel ──

export { EVENT_ICONS };

/** Severity tiers for visual hierarchy */
const CRITICAL_EVENTS = new Set(['agent_excluded', 'stake_slashed', 'agent_suspended', 'capability_violation']);
const GOVERNANCE_EVENTS = new Set(['proposal_created', 'vote_tallied', 'rule_changed']);

export function EventsList({ history, agents }: { history: RoundResult[]; agents?: Array<{ id: string; name: string; personality?: string }> }) {
  const agentMap = new Map(agents?.map((a) => [a.id, a.name]) ?? []);
  const personalityMap = new Map(agents?.map((a) => [a.id, (a as { personality?: string }).personality ?? '']) ?? []);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Scroll size={24} weight="duotone" className="text-[var(--text-secondary)] opacity-30" />
        <div className="text-[var(--text-secondary)] text-[11px] text-center leading-relaxed">
          Governance events will appear here as rounds progress.<br />
          <span className="text-[10px] opacity-60">Proposals, votes, sanctions, enforcement actions</span>
        </div>
      </div>
    );
  }

  const reversed = [...history].reverse();

  return (
    <div className="relative pt-1 pb-2">
      {/* Timeline connector line */}
      <div
        className="absolute left-[11px] top-3 bottom-3 w-px"
        style={{ backgroundColor: 'var(--border)' }}
      />

      {reversed.map((round, idx) => {
        const prev = idx < reversed.length - 1 ? reversed[idx + 1] : undefined;
        return (
          <RoundEntry
            key={round.round}
            round={round}
            prev={prev}
            agentMap={agentMap}
            personalityMap={personalityMap}
          />
        );
      })}
    </div>
  );
}

export function CommonsFooter({ history }: { history: RoundResult[] }) {
  if (history.length === 0) return null;
  return (
    <div className="px-4 py-3 border-t border-[var(--border)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <TreeEvergreen size={12} weight="duotone" className="text-[var(--commons-teal)]" />
          <span className="text-[10px] text-[var(--text-secondary)]">Commons</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkline
            data={history.slice(-20).map(r => r.commonsLevel)}
            color="var(--commons-teal)"
            width={60}
            height={16}
          />
          <span className="text-[10px] text-[var(--text-secondary)]">
            <Handshake size={10} className="inline mr-0.5" />
            {((history[history.length - 1]?.actualCooperationRate ?? 0) * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <CommonsBar history={history} />

      {history[history.length - 1]?.territorySnapshot.totalEcosystemValue != null && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="flex items-center gap-1 text-[var(--text-secondary)]">
              <Leaf size={11} weight="duotone" className="text-[var(--governance-green)]" />
              Ecosystem Services
            </span>
            <span className="font-mono text-[var(--governance-green)]">
              {formatEURCompact(history[history.length - 1].territorySnapshot.totalEcosystemValue!)}/yr
              {history.length > 1 && history[history.length - 2]?.territorySnapshot.totalEcosystemValue != null && (
                <DeltaBadge
                  current={history[history.length - 1].territorySnapshot.totalEcosystemValue!}
                  previous={history[history.length - 2].territorySnapshot.totalEcosystemValue!}
                />
              )}
            </span>
          </div>
          {history[history.length - 1].territorySnapshot.greenAssets && (() => {
            const ga = history[history.length - 1].territorySnapshot.greenAssets!;
            const carbon = ga.assets.find(a => a.assetClass === 'carbon_credit');
            const bio = ga.assets.find(a => a.assetClass === 'biodiversity_credit');
            return (
              <div className="flex items-center gap-3 text-[9px]">
                {carbon && carbon.currentUnits > 0 && (
                  <span className="flex items-center gap-0.5 text-[var(--eco-carbon)]">
                    <Drop size={9} /> {carbon.currentUnits.toFixed(0)} tCO2e
                  </span>
                )}
                {bio && bio.currentUnits > 0 && (
                  <span className="flex items-center gap-0.5 text-[var(--eco-bio)]">
                    <PawPrint size={9} /> {bio.currentUnits.toFixed(0)} ha-eq
                  </span>
                )}
                <span className="text-[var(--text-secondary)]">possible</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Storacha audit trail link */}
      {(() => {
        const latestCid = history[history.length - 1]?.cid;
        const cidCount = history.filter(r => r.cid).length;
        const gwUrl = latestCid ? getGatewayUrl(latestCid) : null;
        const isLocal = latestCid ? isLocalPseudoCID(latestCid) : false;
        return (
          <div className="mt-2.5 pt-2.5 border-t border-[var(--border)]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                <HardDrives size={11} weight="duotone" className="text-[var(--commons-teal)]" />
                Storacha Audit Trail
                <span className="text-[9px] font-mono opacity-60">{cidCount} CIDs</span>
              </span>
              {gwUrl ? (
                <a
                  href={gwUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded transition-colors bg-[var(--commons-teal)]/15 text-[var(--commons-teal)] hover:bg-[var(--commons-teal)]/25"
                >
                  <ArrowSquareOut size={10} weight="bold" />
                  View on Storacha
                </a>
              ) : latestCid ? (
                <button
                  className="flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded transition-colors bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  onClick={() => navigator.clipboard.writeText(latestCid)}
                >
                  <HardDrives size={10} weight="bold" />
                  Copy CID
                </button>
              ) : null}
            </div>
            {latestCid && (
              <div className="text-[8px] font-mono text-[var(--commons-teal)] mt-1 truncate opacity-50" title={latestCid}>
                {latestCid}{isLocal && ' (local)'}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export function GovernanceTimeline({ history, agents }: Props) {
  const [tab, setTab] = useState<'events' | 'metrics'>('events');

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] overflow-hidden">
      {/* Tab bar */}
      <div className="px-4 pt-2.5 pb-1">
        <div className="tab-group">
          <button
            className={`tab-pill ${tab === 'events' ? 'active' : ''}`}
            onClick={() => setTab('events')}
          >
            <Scroll size={11} className="inline mr-1" />
            Events
          </button>
          <button
            className={`tab-pill ${tab === 'metrics' ? 'active' : ''}`}
            onClick={() => setTab('metrics')}
          >
            <ChartLineUp size={11} className="inline mr-1" />
            Metrics
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {tab === 'events' ? (
          <EventsList history={history} agents={agents} />
        ) : (
          <MetricsCharts history={history} />
        )}
      </div>

      {/* Pinned footer */}
      <CommonsFooter history={history} />
    </div>
  );
}

function BallotViz({ ballot, agentMap }: { ballot: BallotSummary; agentMap: Map<string, string> }) {
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
  const [showSealDetails, setShowSealDetails] = useState(false);

  if (!ballot || !ballot.totalVoters) return null;

  const progress = (ballot.votesCast / ballot.totalVoters) * 100;
  const thresholdPct = ballot.disclosureThreshold * 100;
  const votes = ballot.disclosed && ballot.results?.votes ? ballot.results.votes : [];

  const handleVerify = async () => {
    if (!ballot.litSeal || verifyState === 'verifying') return;
    setVerifyState('verifying');
    try {
      const result = await verifySeal(ballot.litSeal as any);
      setVerifyState(result ? 'verified' : 'failed');
    } catch {
      setVerifyState('failed');
    }
    setTimeout(() => setVerifyState('idle'), 4000);
  };

  return (
    <div className="ml-4 my-1.5 p-3 rounded-lg border border-[var(--sacred-purple)]/30 bg-[var(--bg-base)]">
      <div className="text-[10px] text-[var(--text-primary)] mb-2">
        <span className="text-[var(--sacred-purple)] font-medium">Proposal: </span>
        {ballot.proposalDescription}
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between text-[9px] text-[var(--text-secondary)] mb-1">
          <span>Ballots: {ballot.votesCast}/{ballot.totalVoters}</span>
          <span>Threshold: {thresholdPct.toFixed(0)}%</span>
        </div>
        <div className="relative h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: ballot.thresholdMet ? 'var(--sacred-purple)' : 'var(--warning-amber)',
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-[var(--text-secondary)]"
            style={{ left: `${thresholdPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 mb-2">
        {votes.length > 0
          ? votes.map((v, i) => (
              <span
                key={i}
                className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold"
                style={{
                  backgroundColor: v.vote === 'yes' ? 'var(--governance-green)' : 'var(--danger-red)',
                  color: 'var(--bg-base)',
                }}
                title={`${agentMap.get(v.agentId) ?? v.agentId.slice(0, 8)}: ${v.vote}`}
              >
                {v.vote === 'yes' ? 'Y' : 'N'}
              </span>
            ))
          : Array.from({ length: ballot.votesCast }).map((_, i) => (
              <span
                key={i}
                className="w-5 h-5 rounded flex items-center justify-center text-[8px]"
                style={{ backgroundColor: 'var(--sacred-purple)', color: 'var(--bg-base)' }}
                title="Encrypted ballot (sealed)"
              >
                ?
              </span>
            ))
        }
      </div>

      {ballot.disclosed && ballot.results ? (
        <div className="text-[10px]">
          <span className="text-[var(--sacred-purple)]">Threshold disclosure</span>
          <span className="text-[var(--text-secondary)]"> — </span>
          <span className="text-[var(--governance-green)]">{ballot.results.yes} yes</span>
          <span className="text-[var(--text-secondary)]">, </span>
          <span className="text-[var(--danger-red)]">{ballot.results.no} no</span>
          <span className="text-[var(--text-secondary)]"> — </span>
          <span className={ballot.results.yes > ballot.results.no ? 'text-[var(--governance-green)] font-semibold' : 'text-[var(--danger-red)] font-semibold'}>
            {ballot.results.yes > ballot.results.no ? 'PASSED' : 'REJECTED'}
          </span>
        </div>
      ) : (
        <div className="text-[9px] text-[var(--sacred-purple)]">
          Ballots sealed — awaiting threshold ({thresholdPct.toFixed(0)}%)
        </div>
      )}

      {/* Lit Protocol seal indicator */}
      {ballot.litSeal ? (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--border)]">
          <button
            onClick={(e) => { e.stopPropagation(); setShowSealDetails(!showSealDetails); }}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--sacred-purple)]" />
            <span className="text-[9px] text-[var(--sacred-purple)] font-medium">Sealed via Lit Network</span>
            <span className="text-[8px] text-[var(--text-secondary)] font-mono" title={ballot.litSeal.ciphertext}>
              {ballot.litSeal.dataToEncryptHash.slice(0, 16)}...
            </span>
            <CaretDown size={8} className={`ml-auto text-[var(--text-secondary)] transition-transform ${showSealDetails ? 'rotate-180' : ''}`} />
          </button>

          {showSealDetails && (
            <div className="mt-2 p-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--sacred-purple)]/20 animate-slide-up">
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div>
                  <span className="text-[var(--text-secondary)]">Network</span>
                  <div className="font-mono text-[var(--sacred-purple)]">{ballot.litSeal.network ?? 'nagaDev'}</div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Sealed</span>
                  <div className="font-mono text-[var(--text-primary)]">
                    {ballot.litSeal.sealedAt ? new Date(ballot.litSeal.sealedAt).toLocaleTimeString() : '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-[var(--text-secondary)]">Data Hash</span>
                  <div className="font-mono text-[var(--text-primary)] truncate" title={ballot.litSeal.dataToEncryptHash}>
                    {ballot.litSeal.dataToEncryptHash}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-[var(--text-secondary)]">Access Control</span>
                  <div className="font-mono text-[var(--info-blue)]">evmBasic (always-true demo)</div>
                </div>
              </div>

              {isLitConnected() && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleVerify(); }}
                  disabled={verifyState === 'verifying'}
                  className={`mt-2.5 w-full flex items-center justify-center gap-1.5 text-[9px] font-medium px-2 py-1.5 rounded transition-colors ${
                    verifyState === 'verified'
                      ? 'bg-[var(--governance-green)]/20 text-[var(--governance-green)]'
                      : verifyState === 'failed'
                        ? 'bg-[var(--danger-red)]/20 text-[var(--danger-red)]'
                        : 'bg-[var(--sacred-purple)]/15 text-[var(--sacred-purple)] hover:bg-[var(--sacred-purple)]/25'
                  }`}
                >
                  <SealCheck size={11} weight="bold" />
                  {verifyState === 'verifying' ? 'Verifying on Lit Network...'
                    : verifyState === 'verified' ? 'Seal Verified'
                    : verifyState === 'failed' ? 'Verification Failed'
                    : 'Verify on Lit Network'}
                </button>
              )}
            </div>
          )}
        </div>
      ) : ballot.disclosed ? (
        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-[var(--border)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-40" />
          <span className="text-[9px] text-[var(--text-secondary)]">Local crypto (Shamir SSS)</span>
        </div>
      ) : null}
    </div>
  );
}

function RoundEntry({
  round,
  prev,
  agentMap,
  personalityMap,
}: {
  round: RoundResult;
  prev?: RoundResult;
  agentMap: Map<string, string>;
  personalityMap: Map<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);

  const events = round.governanceEvents.filter((e) => e.type !== 'vote_cast');
  const hasEvents = events.length > 0;
  const hasBallot = !!round.ballotSummary;
  const hasCritical = events.some((e) => CRITICAL_EVENTS.has(e.type));
  const hasGovernance = events.some((e) => GOVERNANCE_EVENTS.has(e.type));

  // Round metrics
  const commonsDelta = prev ? round.commonsLevel - prev.commonsLevel : 0;
  const coopRate = round.actualCooperationRate ?? 0;
  const actionCount = round.actions.length;

  // Categorize actions
  const consumeCount = round.actions.filter((a) => a.type === 'consume').length;
  const contributeCount = round.actions.filter((a) => a.type === 'contribute').length;

  // Node color reflects the "mood" of this round
  const nodeColor = hasCritical
    ? 'var(--danger-red)'
    : hasGovernance
      ? 'var(--sacred-purple)'
      : hasEvents
        ? 'var(--info-blue)'
        : 'var(--border)';

  const isQuietRound = !hasEvents && !hasBallot;

  return (
    <div className="relative pl-7 pb-2 group">
      {/* Timeline node */}
      <div
        className={`absolute left-1.5 top-1.5 w-4 h-4 rounded-full flex items-center justify-center z-10 border-2 ${
          hasCritical ? 'animate-pulse' : ''
        }`}
        style={{
          backgroundColor: isQuietRound ? 'var(--bg-surface)' : nodeColor,
          borderColor: isQuietRound ? nodeColor : nodeColor,
          color: isQuietRound ? nodeColor : 'var(--bg-base)',
        }}
      >
        {!isQuietRound && <span className="text-[7px] font-bold">{events.length}</span>}
      </div>

      {/* Round header */}
      <div
        className={`flex items-center gap-2 cursor-pointer select-none ${
          isQuietRound ? 'opacity-50 hover:opacity-80' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">
          R{round.round}
        </span>

        {/* Mini metrics inline */}
        <div className="flex items-center gap-2 text-[9px]">
          {/* Commons delta */}
          {prev && (
            <span
              className="flex items-center gap-0.5 font-mono"
              style={{
                color: commonsDelta > 0 ? 'var(--governance-green)' : commonsDelta < 0 ? 'var(--danger-red)' : 'var(--text-secondary)',
              }}
            >
              {commonsDelta > 0 ? <TrendUp size={8} /> : commonsDelta < 0 ? <TrendDown size={8} /> : null}
              {commonsDelta !== 0 && `${commonsDelta > 0 ? '+' : ''}${commonsDelta.toFixed(0)}`}
            </span>
          )}

          {/* Cooperation rate */}
          <span
            className="font-mono"
            style={{
              color: coopRate > 0.6 ? 'var(--governance-green)' : coopRate > 0.3 ? 'var(--warning-amber)' : 'var(--danger-red)',
            }}
          >
            <Handshake size={8} className="inline mr-0.5" />
            {(coopRate * 100).toFixed(0)}%
          </span>

          {/* Action split */}
          {actionCount > 0 && (
            <span className="text-[var(--text-secondary)]">
              <span className="text-[var(--governance-green)]">+{contributeCount}</span>
              <span className="mx-0.5">/</span>
              <span className="text-[var(--danger-red)]">-{consumeCount}</span>
            </span>
          )}
        </div>

        {/* Expand indicator for rounds with content */}
        {!isQuietRound && (
          <span className="ml-auto text-[var(--text-secondary)] opacity-40">
            {expanded ? <CaretUp size={9} /> : <CaretDown size={9} />}
          </span>
        )}

        {/* CID badge at far right */}
        {round.cid && (
          <CIDBadge cid={round.cid} round={round.round} hasLitSeal={!!round.ballotSummary?.litSeal} />
        )}
      </div>

      {/* Event summary chips (always visible for non-quiet rounds) */}
      {!isQuietRound && !expanded && (
        <div className="flex flex-wrap gap-1 mt-1">
          {events.map((event, i) => {
            const evtConfig = EVENT_ICONS[event.type] ?? { icon: null, color: 'var(--text-secondary)' };
            const isCritical = CRITICAL_EVENTS.has(event.type);
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md ${
                  isCritical ? 'font-semibold' : ''
                }`}
                style={{
                  backgroundColor: `color-mix(in srgb, ${evtConfig.color} 15%, transparent)`,
                  color: evtConfig.color,
                }}
              >
                {evtConfig.icon}
                {summarizeEvent(event.type, event.details, agentMap)}
              </span>
            );
          })}
          {hasBallot && (
            <span
              className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--sacred-purple) 15%, transparent)',
                color: 'var(--sacred-purple)',
              }}
            >
              <Lock size={8} weight="bold" />
              Ballot
            </span>
          )}
        </div>
      )}

      {/* Expanded details */}
      {expanded && !isQuietRound && (
        <div className="mt-1.5 space-y-1 animate-slide-up">
          {events.map((event, i) => {
            const evtConfig = EVENT_ICONS[event.type] ?? { icon: null, color: 'var(--text-secondary)' };
            const isCritical = CRITICAL_EVENTS.has(event.type);
            return (
              <div
                key={i}
                className={`flex items-start gap-2 py-1 px-2 rounded-lg ${
                  isCritical ? 'border' : ''
                }`}
                style={{
                  backgroundColor: isCritical
                    ? `color-mix(in srgb, ${evtConfig.color} 8%, transparent)`
                    : undefined,
                  borderColor: isCritical ? `color-mix(in srgb, ${evtConfig.color} 25%, transparent)` : undefined,
                }}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: evtConfig.color, color: 'var(--bg-base)' }}
                >
                  {evtConfig.icon}
                </span>
                <span className="text-[11px] text-[var(--text-primary)] leading-relaxed">
                  {formatEventDetails(event.type, event.details, agentMap, personalityMap)}
                </span>
              </div>
            );
          })}

          {hasBallot && <BallotViz ballot={round.ballotSummary!} agentMap={agentMap} />}
        </div>
      )}
    </div>
  );
}

/** Short chip-friendly summary of an event */
function summarizeEvent(
  type: string,
  details: Record<string, unknown>,
  agentMap: Map<string, string>,
): string {
  const name = (id: unknown) => {
    if (typeof id !== 'string') return '';
    return agentMap.get(id) ?? id.slice(0, 6);
  };
  switch (type) {
    case 'sanction_applied': return `${details.level ?? 'Sanction'} ${name(details.agentId)}`;
    case 'proposal_created': return 'New proposal';
    case 'vote_tallied': return `Vote ${details.result ?? ''}`;
    case 'agent_excluded': return `${name(details.agentId)} excluded`;
    case 'agent_suspended': return `${name(details.agentId)} suspended`;
    case 'enforcement_check': return 'Enforcement';
    case 'stake_slashed': return `${name(details.agentId)} slashed`;
    case 'rule_changed': return 'Rule changed';
    case 'capability_violation': {
      const vector = String(details.attackVector ?? '').replace(/_/g, ' ');
      return `${vector} by ${name(details.agentId)}`;
    }
    default: return type.replace(/_/g, ' ');
  }
}

function CIDBadge({ cid, round: _round, hasLitSeal }: { cid: string; round: number; hasLitSeal?: boolean }) {
  const [copied, setCopied] = useState(false);
  const gatewayUrl = getGatewayUrl(cid);
  const isLocal = isLocalPseudoCID(cid);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(gatewayUrl ?? cid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (gatewayUrl) {
      window.open(gatewayUrl, '_blank', 'noopener');
    } else {
      handleCopy(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`text-[8px] font-mono text-[var(--commons-teal)] hover:text-[var(--text-primary)] transition-colors truncate max-w-[120px] opacity-60 ml-auto ${
        gatewayUrl ? 'underline decoration-dotted' : ''
      }`}
      title={isLocal
        ? `${cid}\n(local pseudo-CID — not on IPFS. Click to copy hash)`
        : `${gatewayUrl}\nClick to open on Storacha gateway`}
    >
      {copied ? 'Copied!' : `${cid.slice(0, 12)}...`}
      {isLocal && <span className="opacity-50 ml-0.5">(local)</span>}
      {hasLitSeal && <span className="text-[var(--sacred-purple)] ml-0.5">*</span>}
    </button>
  );
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  if (Math.abs(delta) < 0.5) return null;
  const color = delta > 0 ? 'var(--governance-green)' : 'var(--danger-red)';
  return (
    <span className="ml-1.5 text-[9px] font-mono" style={{ color }}>
      {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
    </span>
  );
}

function formatEURCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

const PERSONALITY_COLORS: Record<string, string> = {
  cooperator: 'var(--governance-green)',
  'free-rider': 'var(--danger-red)',
  strategic: 'var(--info-blue)',
  whale: 'var(--stake-gold)',
  chaotic: 'var(--sacred-purple)',
};

function formatEventDetails(
  type: string,
  details: Record<string, unknown>,
  agentMap: Map<string, string>,
  personalityMap?: Map<string, string>,
): React.ReactNode {
  const resolveName = (id: unknown): React.ReactNode => {
    if (typeof id !== 'string') return '';
    const name = agentMap.get(id) ?? id.slice(0, 8) + '...';
    const personality = personalityMap?.get(id);
    const color = personality ? PERSONALITY_COLORS[personality] : undefined;
    return color ? <strong style={{ color }}>{name}</strong> : <strong>{name}</strong>;
  };

  switch (type) {
    case 'sanction_applied':
      return <>{details.level ?? 'Sanction'}: {resolveName(details.agentId)} — {String(details.reason ?? '')}</>;
    case 'proposal_created':
      return <>Proposal: "{String(details.description ?? '')}"</>;
    case 'vote_tallied': {
      const method = details.disclosureMethod ? ` [${details.disclosureMethod}]` : '';
      return <>Vote tallied: {String(details.result ?? 'unknown')}{method}</>;
    }
    case 'agent_excluded':
      return <>{resolveName(details.agentId)} excluded — {String(details.reason ?? '')}</>;
    case 'agent_suspended':
      return <>{resolveName(details.agentId)} suspended {String(details.duration ?? '?')}r</>;
    case 'enforcement_check':
      return <>Enforcement: {String(details.type ?? '')}</>;
    case 'stake_slashed':
      return <>{resolveName(details.agentId)} stake slashed: {String(details.amount ?? 0)}</>;
    case 'capability_violation': {
      const vector = String(details.attackVector ?? '');
      const vectorLabel = vector.replace(/_/g, ' ');
      const vectorColor = vector === 'vote_spoof' ? 'var(--sacred-purple)'
        : vector === 'privilege_escalation' ? 'var(--warning-amber)'
        : 'var(--danger-red)';
      const did = typeof details.attemptedBy === 'string' ? details.attemptedBy : '';
      const truncDID = did.length > 24 ? `${did.slice(0, 16)}...${did.slice(-6)}` : did;
      return (
        <>
          <span style={{ color: vectorColor, fontWeight: 600 }}>{vectorLabel}</span>
          {' '}by {resolveName(details.agentId)}
          {truncDID && <span className="text-[9px] font-mono text-[var(--text-secondary)] ml-1">({truncDID})</span>}
          {' — '}{String(details.rejectionReason ?? '')}
        </>
      );
    }
    default:
      return <>{type.replace(/_/g, ' ')}</>;
  }
}

function CommonsBar({ history }: { history: RoundResult[] }) {
  const recent = history.slice(-20);
  const maxLevel = Math.max(...recent.map((r) => r.commonsLevel), 1);

  return (
    <div className="flex items-end gap-px h-7">
      {recent.map((round) => {
        const height = (round.commonsLevel / maxLevel) * 100;
        const color = height > 60 ? 'var(--governance-green)'
          : height > 30 ? 'var(--warning-amber)'
          : 'var(--danger-red)';
        return (
          <div
            key={round.round}
            className="flex-1 rounded-sm transition-all duration-300"
            style={{
              height: `${Math.max(2, height)}%`,
              backgroundColor: color,
            }}
            title={`Round ${round.round}: ${round.commonsLevel.toFixed(0)}`}
          />
        );
      })}
    </div>
  );
}

import type { SimulationState } from '../types';
import { isStorachaConnected, isLocalPseudoCID } from '../engine/storage/storacha';
import { isLitConnected } from '../engine/lit/client';
import { isUCANEnabled } from '../engine/identity/ucan-validator';
import {
  Fingerprint,
  ShieldCheck,
  Lightning,
  Database,
  HardDrives,
  Lock,
  ArrowRight,
  CheckCircle,
  XCircle,
  ArrowSquareOut,
} from '@phosphor-icons/react';

interface Props {
  simulation: SimulationState;
  onOpenCIDExplorer?: () => void;
}

export function ProvenanceChain({ simulation, onOpenCIDExplorer }: Props) {
  // Get sample data from a recent round to illustrate the flow
  const latestRound = simulation.history[simulation.history.length - 1];
  const sampleAction = latestRound?.actions?.[0];
  const sampleAgent = simulation.agents.find(a => a.id === sampleAction?.agentId);
  const hasBallot = simulation.history.some(r => r.ballotSummary);
  const hasLitSeal = simulation.history.some(r => r.ballotSummary?.litSeal);

  // Sponsor status
  const ucanActive = isUCANEnabled() && simulation.agents.some(a => a.identity);
  const storachaActive = isStorachaConnected();
  const litActive = isLitConnected();

  // Count CIDs - use isLocalPseudoCID for accurate detection
  const cidsWithData = simulation.history.filter(r => r.cid);
  const realCIDs = cidsWithData.filter(r => !isLocalPseudoCID(r.cid!)).length;
  const localCIDs = cidsWithData.filter(r => isLocalPseudoCID(r.cid!)).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Database size={14} weight="bold" className="text-[var(--commons-teal)]" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Provenance Chain</h3>
          <span className="text-[10px] text-[var(--text-secondary)]">Sponsor Integration Pipeline</span>
        </div>
        {onOpenCIDExplorer && cidsWithData.length > 0 && (
          <button
            onClick={onOpenCIDExplorer}
            className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg bg-[var(--commons-teal)]/15 text-[var(--commons-teal)] hover:bg-[var(--commons-teal)]/25 transition-colors"
          >
            <HardDrives size={12} weight="bold" />
            View {cidsWithData.length} CIDs
            <ArrowSquareOut size={10} />
          </button>
        )}
      </div>

      {/* Flow visualization */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
        {/* Node 1: Agent DID */}
        <FlowNode
          icon={<Fingerprint size={16} weight="bold" />}
          title="Agent DID"
          color="var(--info-blue)"
          active={ucanActive}
          content={
            sampleAgent?.identity?.did
              ? truncateDID(sampleAgent.identity.did)
              : 'did:key:z6Mk...'
          }
          sponsor="UCAN"
        />

        <FlowArrow />

        {/* Node 2: UCAN Check */}
        <FlowNode
          icon={<ShieldCheck size={16} weight="bold" />}
          title="Capability"
          color="var(--governance-green)"
          active={ucanActive}
          content={
            <div className="flex flex-wrap gap-1">
              {(['vote', 'propose', 'consume'] as const).map(cap => (
                <span
                  key={cap}
                  className="text-[8px] px-1 py-0.5 rounded bg-[var(--bg-base)]"
                >
                  {cap}
                </span>
              ))}
            </div>
          }
          sponsor="UCAN"
        />

        <FlowArrow />

        {/* Node 3: Action */}
        <FlowNode
          icon={<Lightning size={16} weight="bold" />}
          title="Action"
          color="var(--stake-gold)"
          active={true}
          content={
            sampleAction
              ? `${sampleAction.type}: ${sampleAction.amount?.toFixed(0) ?? '—'}`
              : 'contribute: 25'
          }
        />

        <FlowArrow />

        {/* Node 4: Round State / Storacha CID */}
        <FlowNode
          icon={<HardDrives size={16} weight="bold" />}
          title="State CID"
          color="var(--commons-teal)"
          active={storachaActive || localCIDs > 0}
          content={
            <div className="text-[8px] font-mono">
              {latestRound?.cid
                ? `${latestRound.cid.slice(0, 12)}...`
                : 'bafy2bza...'}
            </div>
          }
          sponsor="Storacha"
          badge={realCIDs > 0 ? `${realCIDs} real` : localCIDs > 0 ? `${localCIDs} local` : undefined}
        />

        {/* Node 5: Lit Seal (conditional) */}
        {hasBallot && (
          <>
            <FlowArrow />
            <FlowNode
              icon={<Lock size={16} weight="bold" />}
              title="Ballot Seal"
              color="var(--sacred-purple)"
              active={hasLitSeal}
              content={
                hasLitSeal
                  ? 'MPC encrypted'
                  : 'Shamir local'
              }
              sponsor="Lit Protocol"
            />
          </>
        )}
      </div>

      {/* Sponsor status summary */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--border)]">
        <SponsorBadge name="UCAN" active={ucanActive} color="var(--info-blue)" />
        <SponsorBadge name="Storacha" active={storachaActive} color="var(--commons-teal)" />
        <SponsorBadge name="Lit Protocol" active={litActive} color="var(--sacred-purple)" />
      </div>
    </div>
  );
}

function FlowNode({ icon, title, color, active, content, sponsor, badge }: {
  icon: React.ReactNode;
  title: string;
  color: string;
  active: boolean;
  content: React.ReactNode;
  sponsor?: string;
  badge?: string;
}) {
  return (
    <div
      className={`flex flex-col min-w-[100px] max-w-[120px] rounded-lg border p-3 transition-all ${
        active ? '' : 'opacity-50'
      }`}
      style={{
        borderColor: active ? color : 'var(--border)',
        backgroundColor: active
          ? `color-mix(in srgb, ${color} 8%, var(--bg-elevated))`
          : 'var(--bg-elevated)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-semibold text-[var(--text-primary)]">{title}</span>
      </div>
      <div className="text-[9px] text-[var(--text-secondary)] flex-1">
        {content}
      </div>
      {sponsor && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[var(--border)]">
          <span
            className="text-[8px] font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
              color,
            }}
          >
            {sponsor}
          </span>
          {badge && (
            <span className="text-[7px] text-[var(--text-secondary)] ml-auto">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center px-1 self-center">
      <ArrowRight size={14} className="text-[var(--text-secondary)]" />
    </div>
  );
}

function SponsorBadge({ name, active, color }: { name: string; active: boolean; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {active ? (
        <CheckCircle size={12} weight="fill" style={{ color }} />
      ) : (
        <XCircle size={12} weight="fill" className="text-[var(--text-secondary)] opacity-40" />
      )}
      <span
        className={`text-[10px] font-medium ${active ? '' : 'opacity-50'}`}
        style={{ color: active ? color : 'var(--text-secondary)' }}
      >
        {name}
      </span>
    </div>
  );
}

function truncateDID(did: string): string {
  if (did.length <= 20) return did;
  return `${did.slice(0, 12)}...${did.slice(-4)}`;
}

import { useState } from 'react';
import type { SimulationState, FailureMode } from '../types';
import { ProvenanceChain } from './ProvenanceChain';
import { CIDExplorer } from './CIDExplorer';
import { storeRoundState, isStorachaConnected } from '../engine/storage/storacha';
import {
  Trophy,
  Leaf,
  ChartLineUp,
  WarningCircle,
  XCircle,
  CheckCircle,
  ArrowRight,
  HardDrives,
  X,
  Drop,
  PawPrint,
  Users,
  TrendUp,
  TrendDown,
} from '@phosphor-icons/react';

const PERSONALITY_COLORS: Record<string, string> = {
  cooperator: 'var(--governance-green)',
  'free-rider': 'var(--danger-red)',
  strategic: 'var(--info-blue)',
  whale: 'var(--stake-gold)',
  chaotic: 'var(--sacred-purple)',
};

interface Props {
  simulation: SimulationState;
  onDismiss: () => void;
  onArchive: (cid: string) => Promise<void>;
}

export function SimulationResults({ simulation, onDismiss, onArchive }: Props) {
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);
  const [showCIDExplorer, setShowCIDExplorer] = useState(false);

  const finalRound = simulation.history[simulation.history.length - 1];
  const initialRound = simulation.history[0];
  if (!finalRound) return null;

  // Compute metrics
  const outcome = simulation.status === 'collapsed' ? 'COLLAPSED' : 'COMPLETE';
  const outcomeColor = simulation.status === 'collapsed' ? 'var(--danger-red)' : 'var(--governance-green)';

  // Green assets
  const greenAssets = finalRound.territorySnapshot.greenAssets;
  const initialGreen = initialRound?.territorySnapshot.greenAssets;
  const preservedPct = greenAssets && initialGreen?.totalAnnualPotentialEUR
    ? (greenAssets.preservedPotentialEUR / initialGreen.totalAnnualPotentialEUR) * 100
    : 0;
  const lostPct = 100 - preservedPct;

  // Cooperation accuracy (replicator prediction vs actual)
  const accuracyData = simulation.history
    .filter(r => r.replicatorPrediction !== undefined && r.actualCooperationRate !== undefined)
    .map(r => Math.abs((r.replicatorPrediction ?? 0) - (r.actualCooperationRate ?? 0)));
  const avgAccuracy = accuracyData.length > 0
    ? 1 - (accuracyData.reduce((s, v) => s + v, 0) / accuracyData.length)
    : 0;

  // Agent leaderboard - sort by net economic impact
  const attributions = finalRound.agentAttributions ?? [];
  const sortedAgents = [...simulation.agents]
    .filter(a => !a.excluded)
    .map(agent => ({
      agent,
      attribution: attributions.find(attr => attr.agentId === agent.id),
    }))
    .sort((a, b) => (b.attribution?.netEconomicImpactEUR ?? 0) - (a.attribution?.netEconomicImpactEUR ?? 0));

  // Failure modes
  const triggeredFailures = simulation.failureModes.filter(
    fm => fm.status === 'triggered' || fm.status === 'critical'
  );
  const cascadeChain = buildCascadeChain(triggeredFailures);

  // Carbon and biodiversity
  const carbon = greenAssets?.assets.find(a => a.assetClass === 'carbon_credit');
  const biodiversity = greenAssets?.assets.find(a => a.assetClass === 'biodiversity_credit');

  const handleArchive = async () => {
    if (archiving || archived) return;
    setArchiving(true);
    try {
      const cid = await storeRoundState(finalRound);
      if (cid) {
        await onArchive(cid);
        setArchived(true);
      }
    } catch (e) {
      console.error('Archive failed:', e);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-2xl m-4">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors z-10"
        >
          <X size={18} weight="bold" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-bold px-3 py-1 rounded-full ${
                simulation.status === 'collapsed'
                  ? 'bg-[var(--danger-red)]/15 text-[var(--danger-red)]'
                  : 'bg-[var(--governance-green)]/15 text-[var(--governance-green)]'
              }`}
            >
              {outcome}
            </span>
            <span className="text-[var(--text-secondary)] text-sm">
              Year {simulation.round} / 20
            </span>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mt-2">
            Simulation Results
          </h2>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4">
          <MetricCard
            icon={<ChartLineUp size={16} weight="duotone" />}
            label="Final Commons"
            value={`${finalRound.commonsLevel.toFixed(0)}`}
            color={outcomeColor}
            subtitle={`${simulation.status === 'collapsed' ? 'Below threshold' : 'Sustained'}`}
          />
          <MetricCard
            icon={<Leaf size={16} weight="duotone" />}
            label="Green Assets"
            value={`${preservedPct.toFixed(0)}%`}
            color={preservedPct > 60 ? 'var(--governance-green)' : preservedPct > 30 ? 'var(--warning-amber)' : 'var(--danger-red)'}
            subtitle="Preserved"
          />
          <MetricCard
            icon={<Trophy size={16} weight="duotone" />}
            label="Model Accuracy"
            value={`${(avgAccuracy * 100).toFixed(0)}%`}
            color={avgAccuracy > 0.7 ? 'var(--governance-green)' : avgAccuracy > 0.4 ? 'var(--warning-amber)' : 'var(--danger-red)'}
            subtitle="Replicator eq."
          />
        </div>

        {/* Agent leaderboard */}
        <div className="px-6 py-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} weight="bold" className="text-[var(--text-secondary)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Agent Leaderboard</h3>
            <span className="text-[10px] text-[var(--text-secondary)]">(by net economic impact)</span>
          </div>
          <div className="space-y-1.5">
            {sortedAgents.slice(0, 5).map(({ agent, attribution }, idx) => {
              const net = attribution?.netEconomicImpactEUR ?? 0;
              const color = PERSONALITY_COLORS[agent.personality] ?? 'var(--text-secondary)';
              return (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-elevated)]"
                >
                  <span className="text-xs font-mono font-bold text-[var(--text-secondary)] w-5">
                    {idx + 1}.
                  </span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">
                    {agent.name}
                  </span>
                  <span
                    className="text-sm font-mono font-semibold flex items-center gap-1"
                    style={{ color: net >= 0 ? 'var(--governance-green)' : 'var(--danger-red)' }}
                  >
                    {net >= 0 ? <TrendUp size={12} /> : <TrendDown size={12} />}
                    {net >= 0 ? '+' : ''}€{formatCompact(Math.abs(net))}
                  </span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                      color,
                    }}
                  >
                    {agent.personality}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Green assets bar */}
        <div className="px-6 py-4 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Green Asset Potential</span>
            <div className="flex items-center gap-3 text-[10px]">
              {carbon && (
                <span className="flex items-center gap-1 text-[var(--eco-carbon)]">
                  <Drop size={10} /> {carbon.currentUnits.toFixed(0)} tCO2e
                </span>
              )}
              {biodiversity && (
                <span className="flex items-center gap-1 text-[var(--eco-bio)]">
                  <PawPrint size={10} /> {biodiversity.currentUnits.toFixed(0)} ha-eq
                </span>
              )}
            </div>
          </div>
          <div className="h-4 rounded-full overflow-hidden flex bg-[var(--bg-base)]">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${preservedPct}%`,
                backgroundColor: 'var(--governance-green)',
              }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${lostPct}%`,
                backgroundColor: 'var(--danger-red)',
                opacity: 0.6,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--text-secondary)]">
            <span className="text-[var(--governance-green)]">Preserved: {preservedPct.toFixed(0)}%</span>
            <span className="text-[var(--danger-red)]">Lost: {lostPct.toFixed(0)}%</span>
          </div>
        </div>

        {/* Failure modes */}
        {cascadeChain.length > 0 && (
          <div className="px-6 py-4 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              <WarningCircle size={14} weight="bold" className="text-[var(--warning-amber)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Failure Modes Triggered</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {cascadeChain.map((fm, idx) => (
                <div key={fm.id} className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-lg font-medium ${
                      fm.status === 'critical'
                        ? 'bg-[var(--danger-red)]/15 text-[var(--danger-red)]'
                        : 'bg-[var(--warning-amber)]/15 text-[var(--warning-amber)]'
                    }`}
                  >
                    {fm.name}
                  </span>
                  {idx < cascadeChain.length - 1 && (
                    <ArrowRight size={12} className="text-[var(--text-secondary)]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provenance chain */}
        <div className="px-6 py-4 border-t border-[var(--border)]">
          <ProvenanceChain simulation={simulation} onOpenCIDExplorer={() => setShowCIDExplorer(true)} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)]">
          {isStorachaConnected() && !simulation.stateCID && (
            <button
              onClick={handleArchive}
              disabled={archiving || archived}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                archived
                  ? 'bg-[var(--governance-green)]/15 text-[var(--governance-green)]'
                  : archiving
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    : 'bg-[var(--commons-teal)]/15 text-[var(--commons-teal)] hover:bg-[var(--commons-teal)]/25'
              }`}
            >
              {archived ? (
                <>
                  <CheckCircle size={16} weight="bold" />
                  Archived
                </>
              ) : archiving ? (
                <>
                  <HardDrives size={16} weight="bold" className="animate-pulse" />
                  Archiving...
                </>
              ) : (
                <>
                  <HardDrives size={16} weight="bold" />
                  Archive to Storacha
                </>
              )}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
          >
            <XCircle size={16} weight="bold" />
            Dismiss & Reset
          </button>
        </div>
      </div>

      {/* CID Explorer modal (nested) */}
      <CIDExplorer
        open={showCIDExplorer}
        onClose={() => setShowCIDExplorer(false)}
        history={simulation.history}
      />
    </div>
  );
}

function MetricCard({ icon, label, value, color, subtitle }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] text-[var(--text-secondary)] mt-1">{subtitle}</div>
      )}
    </div>
  );
}

function buildCascadeChain(failures: FailureMode[]): FailureMode[] {
  if (failures.length === 0) return [];

  // Sort by round triggered, then build cascade order
  const sorted = [...failures].sort((a, b) => (a.roundTriggered ?? 0) - (b.roundTriggered ?? 0));

  // Simple approach: return in trigger order, showing cascade relationships
  const chain: FailureMode[] = [];
  const seen = new Set<string>();

  for (const fm of sorted) {
    if (!seen.has(fm.id)) {
      chain.push(fm);
      seen.add(fm.id);
    }
  }

  return chain;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

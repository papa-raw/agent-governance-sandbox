import { useState, useCallback } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { TerritoryMap } from './components/TerritoryMap';
import { AgentPanel } from './components/AgentPanel';
// GovernanceTimeline merged into AgentPanel — sub-components imported there
import { SimulationControls } from './components/SimulationControls';
import { IntroPanel } from './components/IntroPanel';
import { RoundTransition } from './components/RoundTransition';
import { DocsModal } from './components/DocsModal';
import { SimulationResults } from './components/SimulationResults';
import { CIDExplorer } from './components/CIDExplorer';
import {
  GlobeHemisphereWest,
  MapPin,
  Hash,
  Gauge,
  UsersThree,
  HardDrives,
  Brain,
  Fingerprint,
  CurrencyEur,
  Leaf,
  Bank,
  BookOpen,
  TrendUp,
  TrendDown,
} from '@phosphor-icons/react';
import type { SimulationState, GovernanceConfigId } from './types';
import type { AgentTemplate } from './engine/agents';
import { createSimulation, executeRound, initializeAgentIdentities } from './engine/simulation';
import { createCamargueAgents, assignZonesToAgents } from './engine/agents';
import { GOVERNANCE_PRESETS } from './engine/governance/presets';
import { buildTerritoryFromGeoJSON } from './engine/territory';
import { generateLLMActions, clearPromptCache } from './engine/llm/runtime';
import { isLLMAvailable } from './engine/llm/client';
import { storeRoundState, isStorachaConnected, initStoracha } from './engine/storage/storacha';
import { initLit, isLitConnected } from './engine/lit/client';
import { isUCANEnabled } from './engine/identity/ucan-validator';
import camargueData from './data/camargue.json';

export const MAX_YEARS = 20;

function App() {
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<GovernanceConfigId>('ostrom');
  const [isRunning, setIsRunning] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [docsSection, setDocsSection] = useState<string | undefined>(undefined);
  const [showResults, setShowResults] = useState(false);
  const [showCIDExplorer, setShowCIDExplorer] = useState(false);
  // Counter that triggers re-render when Storacha/Lit finish initializing
  const [, setInfraReady] = useState(0);

  const dismissTransition = useCallback(() => setShowTransition(false), []);

  const startSimulation = async (customTemplates?: AgentTemplate[]) => {
    const config = GOVERNANCE_PRESETS.find((p) => p.id === selectedConfig) ?? GOVERNANCE_PRESETS[1];
    const baseAgents = createCamargueAgents(customTemplates);
    const territory = buildTerritoryFromGeoJSON(camargueData as GeoJSON.FeatureCollection);
    const agents = assignZonesToAgents(
      baseAgents,
      territory.zones.map((z) => ({ zoneId: z.id, category: z.category })),
    );
    let sim = createSimulation(config, agents, territory);

    // Mint UCAN identities for all agents (Web Crypto, ~instant)
    sim = await initializeAgentIdentities(sim);

    setSimulation({ ...sim, status: 'running' });

    // Lazy-init Storacha + Lit Protocol (non-blocking — available by first round/vote)
    initStoracha().then(() => setInfraReady(v => v + 1)).catch(() => {});
    initLit().then(() => setInfraReady(v => v + 1)).catch(() => {});
  };

  const stepRound = async () => {
    if (!simulation || simulation.status === 'completed' || simulation.status === 'collapsed') return;
    setIsRunning(true);

    try {
      const actions = await generateLLMActions(simulation, generateDeterministicActions);
      const { state, result } = await executeRound(simulation, actions);

      // Compute CID for this round's state
      try {
        result.cid = await storeRoundState(result);
      } catch { /* local fallback handled inside storeRoundState */ }

      // Auto-complete at max years
      const finalState = state.round >= MAX_YEARS
        ? { ...state, status: 'completed' as const }
        : state;
      setSimulation(finalState);
      setShowTransition(true);
      // Show results panel when simulation ends
      if (finalState.status === 'completed' || finalState.status === 'collapsed') {
        setShowResults(true);
      }
    } catch (error) {
      console.error('Year execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  /** Run N years (or all remaining). Used by +5, Run All, etc. */
  const skipYears = async (count: number) => {
    if (!simulation || simulation.status === 'completed' || simulation.status === 'collapsed') return;
    setIsRunning(true);

    let currentState = simulation;
    const target = Math.min(simulation.round + count, MAX_YEARS);

    try {
      while (currentState.round < target) {
        if (currentState.status === 'completed' || currentState.status === 'collapsed') break;

        const actions = await generateLLMActions(currentState, generateDeterministicActions);
        const { state, result } = await executeRound(currentState, actions);
        currentState = state;

        // Compute CID before state update so it appears in the UI
        try {
          result.cid = await storeRoundState(result);
        } catch { /* local fallback handled inside storeRoundState */ }

        setSimulation({ ...currentState });
        await new Promise((r) => setTimeout(r, isLLMAvailable() ? 500 : 100));
      }

      if (currentState.round >= MAX_YEARS && currentState.status === 'running') {
        currentState = { ...currentState, status: 'completed' };
        setSimulation(currentState);
      }
      setShowTransition(true);
      // Show results panel when simulation ends
      if (currentState.status === 'completed' || currentState.status === 'collapsed') {
        setShowResults(true);
      }
    } catch (error) {
      console.error('Simulation run failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const runSimulation = async () => {
    if (!simulation) {
      startSimulation();
      return;
    }
    await skipYears(MAX_YEARS);
  };

  // Derive latest round data for narrative and agent reasoning
  const latestRound = simulation?.history[simulation.history.length - 1];
  const previousRound = simulation?.history.length && simulation.history.length >= 2
    ? simulation.history[simulation.history.length - 2]
    : null;

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-base)]">
      {/* Header — three-zone layout: Identity | Metrics | Controls */}
      <header className="flex items-center h-11 px-4 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        {/* Zone 1: Identity */}
        <div className="flex items-center gap-2 shrink-0">
          <GlobeHemisphereWest size={18} weight="duotone" className="text-[var(--commons-teal)]" />
          <h1 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">AGS</h1>
          <span className="flex items-center gap-1 text-[9px] text-[var(--text-secondary)]">
            <MapPin size={9} weight="fill" className="text-[var(--commons-teal)] opacity-70" />
            Camargue
          </span>
          <button
            onClick={() => setShowDocs(true)}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)] hover:text-[var(--commons-teal)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="Methodology docs"
          >
            <BookOpen size={13} weight="duotone" />
          </button>
        </div>

        {/* Zone 2: Live Metrics with % deltas — only when simulation is active */}
        {simulation?.commons.territory.totalCommodityValue != null && (() => {
          const t = simulation.commons.territory;
          const p = previousRound?.territorySnapshot;
          const pctDelta = (cur: number, prev?: number) =>
            prev && prev > 0 ? ((cur - prev) / prev) * 100 : null;

          return (
            <div className="flex items-center gap-3.5 ml-3 pl-3 border-l border-[var(--border)]">
              <HeaderMetric
                icon={<Bank size={11} weight="bold" className="text-[var(--commons-teal)]" />}
                value={formatEURCompact(t.totalTerritorialCapital ?? 0)}
                delta={pctDelta(t.totalTerritorialCapital ?? 0, p?.totalTerritorialCapital ?? undefined)}
                title="Territorial Capital"
              />
              <HeaderMetric
                icon={<CurrencyEur size={11} weight="bold" className="text-[var(--stake-gold)]" />}
                value={formatEURCompact(t.totalCommodityValue ?? 0)}
                delta={pctDelta(t.totalCommodityValue ?? 0, p?.totalCommodityValue ?? undefined)}
                title="Commodity Value"
                valueClass="text-[var(--stake-gold)]"
              />
              <HeaderMetric
                icon={<Leaf size={11} weight="bold" className="text-[var(--governance-green)]" />}
                value={formatEURCompact(t.totalEcosystemValue ?? 0)}
                delta={pctDelta(t.totalEcosystemValue ?? 0, p?.totalEcosystemValue ?? undefined)}
                title="Ecosystem Services"
                valueClass="text-[var(--governance-green)]"
              />
            </div>
          );
        })()}

        {/* Spacer */}
        <div className="flex-1 min-w-4" />

        {/* Zone 3: Controls */}
        <SimulationControls
          simulation={simulation}
          selectedConfig={selectedConfig}
          isRunning={isRunning}
          maxYears={MAX_YEARS}
          onConfigChange={setSelectedConfig}
          onStart={() => startSimulation()}
          onStep={stepRound}
          onSkip={() => skipYears(5)}
          onRun={runSimulation}
          onReset={() => { setSimulation(null); setIsRunning(false); clearPromptCache(); }}
        />
      </header>

      {/* Main dashboard */}
      {simulation === null ? (
        <div className="flex-1 overflow-hidden">
          <IntroPanel
            selectedConfig={selectedConfig}
            onConfigChange={setSelectedConfig}
            onStart={(templates) => startSimulation(templates)}
          />
        </div>
      ) : (
        <PanelGroup orientation="horizontal" className="flex-1">
          {/* Left: Territory Map */}
          <Panel defaultSize={60} minSize={40}>
            <TerritoryMap territory={simulation.commons.territory} agents={simulation.agents} />
          </Panel>

          <PanelResizeHandle className="w-1 bg-[var(--border)] hover:bg-[var(--commons-teal)] transition-colors cursor-col-resize" />

          {/* Right: unified Agent Panel (5 tabs) */}
          <Panel defaultSize={40} minSize={25}>
            <AgentPanel
              agents={simulation.agents}
              lastActions={latestRound?.actions}
              attributions={latestRound?.agentAttributions}
              territory={simulation.commons.territory}
              initialGreenPreservedEUR={simulation.history[0]?.territorySnapshot?.greenAssets?.preservedPotentialEUR}
              governance={simulation.governance}
              failureModes={simulation.failureModes}
              history={simulation.history}
            />
          </Panel>
        </PanelGroup>
      )}

      {/* Round transition overlay */}
      {showTransition && latestRound && (
        <RoundTransition
          current={latestRound}
          previous={previousRound}
          onDismiss={dismissTransition}
          autoMs={45000}
          agents={simulation?.agents}
        />
      )}

      {/* Status bar */}
      <footer className="flex items-center justify-between px-5 py-1.5 border-t border-[var(--border)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <Hash size={10} weight="bold" className="opacity-50" />
          Year {simulation?.round ?? 0} / {MAX_YEARS}
          {simulation?.status === 'collapsed' && (
            <span className="text-[var(--danger-red)] font-medium ml-1">COLLAPSED</span>
          )}
          {simulation?.status === 'completed' && (
            <span className="text-[var(--governance-green)] font-medium ml-1">COMPLETE</span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <Gauge size={10} weight="bold" className="opacity-50" />
          {simulation?.commons.resourcePool.toFixed(0) ?? '—'} / {simulation?.commons.maxCapacity.toFixed(0) ?? '—'}
        </span>
        <span className="flex items-center gap-1.5">
          <UsersThree size={10} weight="bold" className="opacity-50" />
          {simulation?.agents.filter((a) => !a.excluded).length ?? 0} active
          <span className="flex items-center gap-0.5 ml-1 opacity-70">
            <Brain size={9} /> {isLLMAvailable() ? 'LLM' : 'deterministic'}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <button
            onClick={() => {
              if (simulation?.history.length) {
                setShowCIDExplorer(true);
              } else {
                setDocsSection('infrastructure');
                setShowDocs(true);
              }
            }}
            className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title={simulation?.history.length ? 'View CID audit trail' : 'Storacha — decentralized audit trail. Click for details.'}
          >
            <HardDrives size={10} weight="bold" className="opacity-50" />
            <span className={`w-1.5 h-1.5 rounded-full ${isStorachaConnected() ? 'bg-[var(--governance-green)]' : 'bg-[var(--text-secondary)] opacity-40'}`} />
            {isStorachaConnected() ? 'Storacha' : 'local CID'}
            {simulation?.history.length ? (
              <span className="flex items-center gap-0.5 ml-0.5">
                <Fingerprint size={9} className="opacity-60" />
                {simulation.history.filter((r) => r.cid).length}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => { setDocsSection('infrastructure'); setShowDocs(true); }}
            className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Lit Protocol — decentralized ballot sealing. Click for details."
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLitConnected() ? 'bg-[var(--sacred-purple)]' : 'bg-[var(--text-secondary)] opacity-40'}`} />
            {isLitConnected() ? 'Lit Naga' : 'Shamir local'}
          </button>
          {isUCANEnabled() && (
            <span
              className="flex items-center gap-1.5"
              title="UCAN capability enforcement — cryptographic agent identity + scoped capabilities"
            >
              <Fingerprint size={10} weight="bold" className="opacity-50" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--info-blue)]" />
              UCAN
              {simulation?.agents.filter((a) => a.identity && !a.identity.revoked).length
                ? <span className="text-[9px] opacity-60">{simulation.agents.filter((a) => a.identity && !a.identity.revoked).length} DIDs</span>
                : null}
            </span>
          )}
        </span>
        <span className="opacity-40">&copy; OpenStreetMap contributors, CARTO</span>
      </footer>

      <DocsModal open={showDocs} onClose={() => { setShowDocs(false); setDocsSection(undefined); }} initialSection={docsSection as any} />

      {/* Simulation results overlay */}
      {showResults && simulation && (simulation.status === 'completed' || simulation.status === 'collapsed') && (
        <SimulationResults
          simulation={simulation}
          onDismiss={() => {
            setShowResults(false);
            setSimulation(null);
            setIsRunning(false);
            clearPromptCache();
          }}
          onArchive={async (cid) => {
            setSimulation(s => s ? { ...s, stateCID: cid } : null);
          }}
        />
      )}

      {/* CID Explorer modal */}
      <CIDExplorer
        open={showCIDExplorer}
        onClose={() => setShowCIDExplorer(false)}
        history={simulation?.history ?? []}
      />
    </div>
  );
}

/**
 * Generate deterministic agent actions based on personality.
 * Used as fallback when VITE_ANTHROPIC_API_KEY is not set.
 */
function generateDeterministicActions(state: SimulationState) {
  const { agents, commons, governance } = state;
  const actions = [];

  for (const agent of agents) {
    if (agent.excluded || agent.suspended) continue;

    const managedZones = agent.managedZones.length > 0
      ? agent.managedZones
      : [];

    switch (agent.personality) {
      case 'cooperator':
        // Contribute first, consume modestly
        if (agent.resources > 20) {
          actions.push({
            agentId: agent.id,
            type: 'contribute' as const,
            amount: Math.min(agent.resources * 0.3, 30),
            targetZones: managedZones.slice(0, 2),
            reasoning: 'Prioritizing commons health over personal gain',
            alignmentNote: 'High environment priority — investing in territory regeneration',
          });
        } else {
          actions.push({
            agentId: agent.id,
            type: 'consume' as const,
            amount: Math.min(10, commons.resourcePool * 0.05),
            targetZones: managedZones.slice(0, 1),
            reasoning: 'Minimal harvest to maintain operations',
          });
        }
        break;

      case 'whale':
        // Consume aggressively, contribute only when forced
        actions.push({
          agentId: agent.id,
          type: 'consume' as const,
          amount: Math.min(
            agent.delegationConfig.authorityBounds.maxConsume,
            commons.resourcePool * 0.15,
          ),
          targetZones: managedZones.slice(0, 3),
          reasoning: 'Maximizing agricultural output from managed zones',
        });
        // Contribute just enough to avoid sanctions
        if (governance.contributionRequirements.enabled && agent.consumptionHistory.length > 0) {
          const avgConsumed = agent.consumptionHistory.slice(-3).reduce((s, v) => s + v, 0) / 3;
          const minContrib = avgConsumed * (governance.contributionRequirements.minContributionPercent / 100);
          const avgContrib = agent.contributionHistory.slice(-3).reduce((s, v) => s + v, 0) / 3;
          if (avgContrib < minContrib * 1.1 && agent.resources > minContrib) {
            actions.push({
              agentId: agent.id,
              type: 'contribute' as const,
              amount: minContrib * 1.05,
              reasoning: 'Contributing minimum to avoid sanctions',
            });
          }
        }
        break;

      case 'strategic':
        // Adapt to rules — consume moderately, contribute strategically
        {
          const consumeAmount = Math.min(25, commons.resourcePool * 0.08);
          actions.push({
            agentId: agent.id,
            type: 'consume' as const,
            amount: consumeAmount,
            targetZones: managedZones.slice(0, 2),
            reasoning: 'Balanced extraction from managed salt production zones',
          });
          // Contribute proportionally
          if (governance.contributionRequirements.enabled) {
            actions.push({
              agentId: agent.id,
              type: 'contribute' as const,
              amount: consumeAmount * 0.2,
              reasoning: 'Strategic contribution to maintain governance standing',
            });
          }
        }
        break;

      case 'free-rider':
        // Consume maximum, contribute minimum
        actions.push({
          agentId: agent.id,
          type: 'consume' as const,
          amount: Math.min(
            agent.delegationConfig.authorityBounds.maxConsume,
            commons.resourcePool * 0.12,
          ),
          targetZones: managedZones,
          reasoning: 'Harvesting available resources during season',
        });
        break;

      case 'chaotic':
        // Random behavior
        {
          const random = Math.random();
          if (random < 0.4) {
            actions.push({
              agentId: agent.id,
              type: 'consume' as const,
              amount: Math.min(30, commons.resourcePool * 0.1),
              targetZones: managedZones.slice(0, 1),
              reasoning: 'Developing coastal infrastructure',
            });
          } else if (random < 0.7) {
            actions.push({
              agentId: agent.id,
              type: 'contribute' as const,
              amount: Math.min(agent.resources * 0.2, 20),
              reasoning: 'Eco-tourism initiative — investing in habitat preservation',
              alignmentNote: 'Tourism benefits from preserved landscape',
            });
          } else {
            actions.push({
              agentId: agent.id,
              type: 'abstain' as const,
              reasoning: 'Off-season — no significant activity',
            });
          }
        }
        break;
    }
  }

  return actions;
}

function formatEURCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

/** Compact metric with optional % delta for the header bar */
function HeaderMetric({ icon, value, delta, title, valueClass }: {
  icon: React.ReactNode;
  value: string;
  delta: number | null;
  title: string;
  valueClass?: string;
}) {
  const showDelta = delta !== null && Math.abs(delta) >= 0.1;
  return (
    <span className="flex items-center gap-1.5" title={title}>
      {icon}
      <span className={`text-[11px] font-mono font-semibold ${valueClass ?? 'text-[var(--text-primary)]'}`}>
        {value}
      </span>
      {showDelta && (
        <span
          className="flex items-center gap-px text-[9px] font-mono tabular-nums"
          style={{ color: delta! > 0 ? 'var(--governance-green)' : 'var(--danger-red)' }}
        >
          {delta! > 0
            ? <TrendUp size={8} weight="bold" />
            : <TrendDown size={8} weight="bold" />}
          {delta! > 0 ? '+' : ''}{delta!.toFixed(1)}%
        </span>
      )}
    </span>
  );
}

export default App;

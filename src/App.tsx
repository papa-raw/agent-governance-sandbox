import { useState } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { TerritoryMap } from './components/TerritoryMap';
import { AgentPanel } from './components/AgentPanel';
import { GovernanceTimeline } from './components/GovernanceTimeline';
import { SimulationControls } from './components/SimulationControls';
import type { SimulationState, GovernanceConfigId } from './types';
import { createSimulation, executeRound } from './engine/simulation';
import { createCamargueAgents, assignZonesToAgents } from './engine/agents';
import { GOVERNANCE_PRESETS } from './engine/governance/presets';
import { buildTerritoryFromGeoJSON } from './engine/territory';
import { generateLLMActions, clearPromptCache } from './engine/llm/runtime';
import { isLLMAvailable } from './engine/llm/client';
import camargueData from './data/camargue.json';

function App() {
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<GovernanceConfigId>('ostrom');
  const [isRunning, setIsRunning] = useState(false);

  const startSimulation = () => {
    const config = GOVERNANCE_PRESETS.find((p) => p.id === selectedConfig) ?? GOVERNANCE_PRESETS[1];
    const baseAgents = createCamargueAgents();
    const territory = buildTerritoryFromGeoJSON(camargueData as GeoJSON.FeatureCollection);
    const agents = assignZonesToAgents(
      baseAgents,
      territory.zones.map((z) => ({ zoneId: z.id, category: z.category })),
    );
    const sim = createSimulation(config, agents, territory);
    setSimulation({ ...sim, status: 'running' });
  };

  const stepRound = async () => {
    if (!simulation || simulation.status === 'completed' || simulation.status === 'collapsed') return;
    setIsRunning(true);

    const actions = await generateLLMActions(simulation, generateDeterministicActions);
    const { state } = executeRound(simulation, actions);
    setSimulation(state);
    setIsRunning(false);
  };

  const runSimulation = async () => {
    if (!simulation) {
      startSimulation();
      return;
    }
    setIsRunning(true);

    let currentState = simulation;
    const maxRounds = 50;

    for (let i = 0; i < maxRounds; i++) {
      if (currentState.status === 'completed' || currentState.status === 'collapsed') break;

      const actions = await generateLLMActions(currentState, generateDeterministicActions);
      const { state } = executeRound(currentState, actions);
      currentState = state;

      setSimulation({ ...currentState });
      await new Promise((r) => setTimeout(r, isLLMAvailable() ? 500 : 100));
    }

    if (currentState.status === 'running') {
      currentState = { ...currentState, status: 'completed' };
      setSimulation(currentState);
    }
    setIsRunning(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-base)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Agent Governance Sandbox
          </h1>
          <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded">
            Camargue, France
          </span>
        </div>
        <SimulationControls
          simulation={simulation}
          selectedConfig={selectedConfig}
          isRunning={isRunning}
          onConfigChange={setSelectedConfig}
          onStart={startSimulation}
          onStep={stepRound}
          onRun={runSimulation}
          onReset={() => { setSimulation(null); setIsRunning(false); clearPromptCache(); }}
        />
      </header>

      {/* Main dashboard */}
      <PanelGroup orientation="horizontal" className="flex-1">
        {/* Left: Territory Map */}
        <Panel defaultSize={60} minSize={40}>
          <TerritoryMap territory={simulation?.commons.territory} />
        </Panel>

        <PanelResizeHandle className="w-1 bg-[var(--border)] hover:bg-[var(--commons-teal)] transition-colors cursor-col-resize" />

        {/* Right: Agent Panel + Timeline */}
        <Panel defaultSize={40} minSize={25}>
          <PanelGroup orientation="vertical">
            <Panel defaultSize={50} minSize={20}>
              <AgentPanel agents={simulation?.agents ?? []} />
            </Panel>

            <PanelResizeHandle className="h-1 bg-[var(--border)] hover:bg-[var(--commons-teal)] transition-colors cursor-row-resize" />

            <Panel defaultSize={50} minSize={20}>
              <GovernanceTimeline
                history={simulation?.history ?? []}
                failureModes={simulation?.failureModes ?? []}
              />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-[var(--border)] bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)]">
        <span>
          Round: {simulation?.round ?? 0}
          {simulation?.status === 'collapsed' && ' — COMMONS COLLAPSED'}
          {simulation?.status === 'completed' && ' — SIMULATION COMPLETE'}
        </span>
        <span>
          Commons: {simulation?.commons.resourcePool.toFixed(0) ?? '—'} / {simulation?.commons.maxCapacity.toFixed(0) ?? '—'}
        </span>
        <span>
          Agents: {simulation?.agents.filter((a) => !a.excluded).length ?? 0} active
          {' '}({isLLMAvailable() ? 'LLM' : 'deterministic'})
        </span>
      </footer>
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

export default App;

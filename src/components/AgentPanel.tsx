import { useState, useMemo } from 'react';
import type { AgentState, AgentAction, AgentAttribution, Territory, GovernanceConfig, FailureMode, RoundResult } from '../types';
import { METHODOLOGY } from '../engine/ecosystem/economics';
import type { LandUseCategory } from '../types';
import { isUCANEnabled } from '../engine/identity/ucan-validator';
import { EventsList, CommonsFooter, EVENT_ICONS } from './GovernanceTimeline';
import { MetricsCharts, Sparkline } from './MetricsCharts';
import {
  Users,
  CurrencyEur,
  ShieldStar,
  Coins,
  UserCircle,
  TrendUp,
  TrendDown,
  Minus,
  WarningCircle,
  Pause,
  XCircle,
  Gavel,
  ShieldCheck,
  HandCoins,
  CheckSquareOffset,
  Lock,
  BookOpen,
  CaretDown,
  CaretUp,
  Scroll,
  ChartLineUp,
  Fingerprint,
  Copy,
  CheckCircle,
} from '@phosphor-icons/react';

const PERSONALITY_COLORS: Record<string, string> = {
  cooperator: 'var(--governance-green)',
  'free-rider': 'var(--danger-red)',
  strategic: 'var(--info-blue)',
  whale: 'var(--stake-gold)',
  chaotic: 'var(--sacred-purple)',
};

const VALUE_COLORS: Record<string, string> = {
  environment: 'var(--governance-green)',
  equity: 'var(--sacred-purple)',
  growth: 'var(--stake-gold)',
  stability: 'var(--info-blue)',
};

interface Props {
  agents: AgentState[];
  lastActions?: AgentAction[];
  attributions?: AgentAttribution[];
  territory?: Territory;
  initialGreenPreservedEUR?: number;
  governance?: GovernanceConfig;
  failureModes?: FailureMode[];
  history?: RoundResult[];
}

export function AgentPanel({ agents, lastActions, attributions, governance, failureModes, history }: Props) {
  const [tab, setTab] = useState<'governance' | 'delegates' | 'events' | 'metrics'>('delegates');

  if (agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-sm p-6">
        <Users size={20} className="mr-2 opacity-40" />
        Start a simulation to see agent delegates
      </div>
    );
  }

  const actionsByAgent = new Map<string, AgentAction[]>();
  if (lastActions) {
    for (const action of lastActions) {
      const existing = actionsByAgent.get(action.agentId);
      if (existing) existing.push(action);
      else actionsByAgent.set(action.agentId, [action]);
    }
  }

  const attrMap = new Map(attributions?.map((a) => [a.agentId, a]));

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] overflow-hidden">
      {/* Tab bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="tab-group">
          <button
            className={`tab-pill ${tab === 'governance' ? 'active' : ''}`}
            onClick={() => setTab('governance')}
          >
            <Gavel size={12} className="inline mr-1" />
            Governance
          </button>
          <button
            className={`tab-pill ${tab === 'delegates' ? 'active' : ''}`}
            onClick={() => setTab('delegates')}
          >
            <Users size={12} className="inline mr-1" />
            Delegates
          </button>
          <button
            className={`tab-pill ${tab === 'events' ? 'active' : ''}`}
            onClick={() => setTab('events')}
          >
            <Scroll size={12} className="inline mr-1" />
            Events
          </button>
          <button
            className={`tab-pill ${tab === 'metrics' ? 'active' : ''}`}
            onClick={() => setTab('metrics')}
          >
            <ChartLineUp size={12} className="inline mr-1" />
            Metrics
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'governance' ? (
          <GovernanceTab governance={governance} failureModes={failureModes ?? []} history={history} agents={agents} />
        ) : tab === 'delegates' ? (
          <DelegatesTab agents={agents} actionsByAgent={actionsByAgent} attrMap={attrMap} />
        ) : tab === 'events' ? (
          <EventsList history={history ?? []} agents={agents} />
        ) : (
          <MetricsCharts history={history ?? []} />
        )}
      </div>

      {/* Pinned footer for events/metrics tabs */}
      {(tab === 'events' || tab === 'metrics') && (
        <CommonsFooter history={history ?? []} />
      )}
    </div>
  );
}

type DelegateSortKey = 'name' | 'resources' | 'reputation' | 'stake' | 'netImpact';

function DelegatesTab({ agents, actionsByAgent, attrMap }: { agents: AgentState[]; actionsByAgent: Map<string, AgentAction[]>; attrMap: Map<string, AgentAttribution> }) {
  const [selectedId, setSelectedId] = useState<string>(agents[0]?.id ?? '');
  const [sortKey, setSortKey] = useState<DelegateSortKey>('reputation');
  const [sortAsc, setSortAsc] = useState(false);

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? agents[0];

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      let va: number | string, vb: number | string;
      switch (sortKey) {
        case 'name': va = a.name; vb = b.name; break;
        case 'resources': va = a.resources; vb = b.resources; break;
        case 'reputation': va = a.reputation; vb = b.reputation; break;
        case 'stake': va = a.stake; vb = b.stake; break;
        case 'netImpact': va = attrMap.get(a.id)?.netEconomicImpactEUR ?? 0; vb = attrMap.get(b.id)?.netEconomicImpactEUR ?? 0; break;
      }
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [agents, sortKey, sortAsc, attrMap]);

  const toggleSort = (key: DelegateSortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div className="space-y-3">
      {/* Featured agent card */}
      {selectedAgent && (
        <AgentCard
          agent={selectedAgent}
          actions={actionsByAgent.get(selectedAgent.id)}
          attribution={attrMap.get(selectedAgent.id)}
        />
      )}

      {/* Sortable ranking table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-base)]">
              <DelegateSortHeader label="Delegate" icon={<Users size={9} />} sortKey="name" current={sortKey} asc={sortAsc} onClick={toggleSort} />
              <DelegateSortHeader label="Res" icon={<CurrencyEur size={9} />} sortKey="resources" current={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
              <DelegateSortHeader label="Rep" icon={<ShieldStar size={9} />} sortKey="reputation" current={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
              <DelegateSortHeader label="Stake" icon={<Coins size={9} />} sortKey="stake" current={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
              <DelegateSortHeader label="Net" icon={<TrendUp size={9} />} sortKey="netImpact" current={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sortedAgents.map((agent) => {
              const attr = attrMap.get(agent.id);
              const net = attr?.netEconomicImpactEUR ?? 0;
              const color = PERSONALITY_COLORS[agent.personality] ?? 'var(--text-secondary)';
              const isSelected = agent.id === selectedId;

              return (
                <tr
                  key={agent.id}
                  onClick={() => setSelectedId(agent.id)}
                  className={`cursor-pointer border-b border-[var(--border)] last:border-b-0 transition-colors ${
                    isSelected ? 'bg-[var(--commons-teal)]/8' : 'hover:bg-[var(--bg-base)]'
                  } ${agent.excluded ? 'opacity-40' : ''}`}
                >
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className={`font-medium truncate ${isSelected ? 'text-[var(--commons-teal)]' : 'text-[var(--text-primary)]'}`}>
                        {agent.name}
                      </span>
                      {agent.excluded && <XCircle size={9} className="text-[var(--danger-red)] shrink-0" />}
                      {agent.suspended && <Pause size={9} className="text-[var(--warning-amber)] shrink-0" />}
                      {agent.sanctionLevel > 0 && !agent.excluded && (
                        <WarningCircle size={9} className="text-[var(--warning-amber)] shrink-0" />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[var(--text-primary)]">{agent.resources.toFixed(0)}</td>
                  <td className="px-2 py-1.5 text-right font-mono" style={{
                    color: agent.reputation > 60 ? 'var(--governance-green)' : agent.reputation > 30 ? 'var(--warning-amber)' : 'var(--danger-red)',
                  }}>{agent.reputation}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[var(--stake-gold)]">{agent.stake}</td>
                  <td className="px-2 py-1.5 text-right font-mono" style={{
                    color: attr ? (net >= 0 ? 'var(--governance-green)' : 'var(--danger-red)') : 'var(--text-secondary)',
                  }}>
                    {attr ? `${net >= 0 ? '+' : ''}${formatEUR(net)}` : '\u2014'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DelegateSortHeader({ label, icon, sortKey, current, asc, onClick, align }: {
  label: string;
  icon: React.ReactNode;
  sortKey: DelegateSortKey;
  current: DelegateSortKey;
  asc: boolean;
  onClick: (key: DelegateSortKey) => void;
  align?: 'right';
}) {
  const isActive = current === sortKey;
  return (
    <th
      onClick={() => onClick(sortKey)}
      className={`px-2 py-1.5 font-semibold cursor-pointer select-none transition-colors hover:text-[var(--text-primary)] ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${isActive ? 'text-[var(--commons-teal)]' : 'text-[var(--text-secondary)]'}`}
    >
      <span className="inline-flex items-center gap-1">
        {icon}
        {label}
        {isActive && (asc ? <CaretUp size={7} /> : <CaretDown size={7} />)}
      </span>
    </th>
  );
}

function GovernanceTab({ governance, failureModes, history, agents }: {
  governance?: GovernanceConfig;
  failureModes: FailureMode[];
  history?: RoundResult[];
  agents?: AgentState[];
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const activeFailureModes = failureModes.filter((fm) => fm.status !== 'inactive');

  // Live governance metrics
  const latestRound = history?.[history.length - 1];
  const coopRate = latestRound?.actualCooperationRate ?? 0;
  const commonsData = history?.slice(-20).map((r) => r.commonsLevel) ?? [];

  // Aggregate governance events across all rounds
  const allGovEvents = history?.flatMap((r) =>
    r.governanceEvents.filter((e) => e.type !== 'vote_cast'),
  ) ?? [];
  const sanctionCount = allGovEvents.filter((e) => e.type === 'sanction_applied').length;

  // Last 5 governance events for the "Recent Events" section
  const recentEvents = allGovEvents.slice(-5).reverse();

  // Agent name lookup
  const agentMap = new Map(agents?.map((a) => [a.id, a.name]) ?? []);

  // Event types from last 3 rounds — used to color rule status dots
  const recentEventTypes = new Set(
    (history?.slice(-3) ?? []).flatMap((r) => r.governanceEvents.map((e) => e.type)),
  );

  return (
    <div className="space-y-3">
      {/* 1. Governance Health Summary */}
      {history && history.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <GovMiniStat
            label="Cooperation"
            value={`${(coopRate * 100).toFixed(0)}%`}
            color={coopRate > 0.6 ? 'var(--governance-green)' : coopRate > 0.3 ? 'var(--warning-amber)' : 'var(--danger-red)'}
          />
          <GovMiniStat
            label="Sanctions"
            value={String(sanctionCount)}
            color={sanctionCount > 0 ? 'var(--warning-amber)' : 'var(--governance-green)'}
          />
          <GovMiniStat
            label="Failures"
            value={String(activeFailureModes.length)}
            color={activeFailureModes.some((f) => f.status === 'critical') ? 'var(--danger-red)' : activeFailureModes.length > 0 ? 'var(--warning-amber)' : 'var(--governance-green)'}
          />
          <div className="rounded-lg p-2 bg-[var(--bg-elevated)] border border-[var(--border)]">
            <div className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">Commons</div>
            {commonsData.length > 1
              ? <Sparkline data={commonsData} color="var(--commons-teal)" width={50} height={14} />
              : <span className="text-[10px] font-mono text-[var(--commons-teal)]">{commonsData[0]?.toFixed(0) ?? '—'}</span>}
          </div>
        </div>
      )}

      {/* 2. Rules as structured rows */}
      {governance && (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <div className="text-[10px] font-semibold text-[var(--text-primary)]">{governance.name}</div>
            <div className="text-[9px] text-[var(--text-secondary)] leading-relaxed mt-0.5">{governance.description}</div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {governance.contributionRequirements.enabled && (
              <RuleRow
                icon={<HandCoins size={12} weight="duotone" />}
                name="Contribution Floor"
                detail={`${governance.contributionRequirements.minContributionPercent}% of consumption, enforced every ${governance.contributionRequirements.enforcementInterval} years`}
                status={recentEventTypes.has('sanction_applied') ? 'warning' : 'ok'}
              />
            )}
            {governance.graduatedSanctions.enabled && (
              <RuleRow
                icon={<Gavel size={12} weight="duotone" />}
                name="Graduated Sanctions"
                detail={governance.graduatedSanctions.levels.map((l) => l.action).join(' \u2192 ')}
                status={recentEventTypes.has('agent_excluded') ? 'critical' : recentEventTypes.has('agent_suspended') ? 'warning' : 'ok'}
              />
            )}
            {governance.boundaryRules.enabled && (
              <RuleRow
                icon={<ShieldCheck size={12} weight="duotone" />}
                name="Boundary Rules"
                detail={`${governance.boundaryRules.admissionMethod.replace(/_/g, ' ')}, max ${governance.boundaryRules.maxAgents} agents`}
                status="ok"
              />
            )}
            {governance.collectiveChoice.enabled && (
              <RuleRow
                icon={<CheckSquareOffset size={12} weight="duotone" />}
                name="Collective Choice"
                detail={`${governance.collectiveChoice.votingMethod.replace(/_/g, ' ')}, ${governance.collectiveChoice.quorumPercent}% quorum`}
                status={recentEventTypes.has('vote_tallied') ? 'active' : 'ok'}
              />
            )}
            {governance.collectiveChoice.enabled && governance.collectiveChoice.ballotPrivacy === 'threshold_disclosure' && (
              <RuleRow
                icon={<Lock size={12} weight="duotone" />}
                name="Threshold Disclosure"
                detail="Lit Protocol sealed ballots"
                status="ok"
                highlight
              />
            )}
            {governance.validationStaking.enabled && (
              <RuleRow
                icon={<Coins size={12} weight="duotone" />}
                name="Validation Staking"
                detail={`Min stake: ${governance.validationStaking.minStake}`}
                status={recentEventTypes.has('stake_slashed') ? 'warning' : 'ok'}
              />
            )}
            {!governance.contributionRequirements.enabled &&
             !governance.graduatedSanctions.enabled &&
             !governance.boundaryRules.enabled &&
             !governance.collectiveChoice.enabled &&
             !governance.validationStaking.enabled && (
              <div className="px-3 py-2.5 text-[10px] text-[var(--danger-red)]">
                No governance rules active — open access regime
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Failure Modes (inline) */}
      {activeFailureModes.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest px-0.5">
            Active Failure Modes
          </div>
          {activeFailureModes.map((fm) => (
            <FailureModeIndicator key={fm.id} mode={fm} allModes={failureModes} />
          ))}
        </div>
      )}

      {/* 4. Recent Governance Events */}
      {recentEvents.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest px-0.5">
            Recent Events
          </div>
          <div className="space-y-1">
            {recentEvents.map((event, i) => {
              const evtConfig = EVENT_ICONS[event.type] ?? { icon: null, color: 'var(--text-secondary)' };
              return (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: evtConfig.color, color: 'var(--bg-base)' }}
                  >
                    {evtConfig.icon}
                  </span>
                  <span className="text-[10px] text-[var(--text-primary)]">
                    {govEventSummary(event.type, event.details, agentMap)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Agent DID Registry (UCAN) */}
      {isUCANEnabled() && agents && agents.some(a => a.identity) && (
        <DIDRegistrySection agents={agents} history={history} />
      )}

      {/* 6. Sources footnote */}
      <div className="pt-1">
        <button
          onClick={() => setSourcesOpen(!sourcesOpen)}
          className="flex items-center gap-1 text-[9px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <BookOpen size={9} />
          Sources & methodology
          {sourcesOpen ? <CaretUp size={8} /> : <CaretDown size={8} />}
        </button>
        {sourcesOpen && (
          <div className="mt-2 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] animate-slide-up">
            <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed mb-2">
              € values from Costanza et al. 2014, Med-ESCWET / Plan Bleu, SRFF, Salins Group.
              Commodity values: high confidence. Ecosystem services: medium confidence.
            </p>
            <p className="text-[9px] text-[var(--text-secondary)] italic leading-relaxed">
              Commodity production peaks at moderate health (1.5x health factor, capped), while ecosystem services scale linearly — the core tragedy dynamic.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(Object.entries(METHODOLOGY) as [LandUseCategory, typeof METHODOLOGY[LandUseCategory]][]).map(([category, entry]) => (
                <span
                  key={category}
                  className={`text-[8px] px-1.5 py-0.5 rounded ${
                    entry.confidence === 'high' ? 'bg-[var(--governance-green)]/15 text-[var(--governance-green)]'
                    : entry.confidence === 'medium' ? 'bg-[var(--warning-amber)]/15 text-[var(--warning-amber)]'
                    : 'bg-[var(--danger-red)]/15 text-[var(--danger-red)]'
                  }`}
                  title={`${entry.notes}\n${entry.sources.join(', ')}`}
                >
                  {category.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GovMiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-2 bg-[var(--bg-elevated)] border border-[var(--border)]">
      <div className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-mono font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function RuleRow({ icon, name, detail, status, highlight }: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  status: 'ok' | 'active' | 'warning' | 'critical';
  highlight?: boolean;
}) {
  const statusColor = {
    ok: 'var(--governance-green)',
    active: 'var(--info-blue)',
    warning: 'var(--warning-amber)',
    critical: 'var(--danger-red)',
  }[status];

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 ${highlight ? 'bg-[var(--sacred-purple)]/5' : ''}`}>
      <span className="text-[var(--text-secondary)]">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium text-[var(--text-primary)]">{name}</div>
        <div className="text-[9px] text-[var(--text-secondary)] truncate">{detail}</div>
      </div>
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${status === 'critical' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: statusColor }}
      />
    </div>
  );
}

function govEventSummary(type: string, details: Record<string, unknown>, agentMap: Map<string, string>): string {
  const name = (id: unknown) => typeof id === 'string' ? (agentMap.get(id) ?? id.slice(0, 8)) : '';
  switch (type) {
    case 'sanction_applied': return `${details.level ?? 'Sanction'} applied to ${name(details.agentId)}`;
    case 'proposal_created': return `Proposal: ${String(details.description ?? '').slice(0, 50)}`;
    case 'vote_tallied': return `Vote ${details.result ?? 'tallied'}`;
    case 'agent_excluded': return `${name(details.agentId)} excluded`;
    case 'agent_suspended': return `${name(details.agentId)} suspended`;
    case 'enforcement_check': return `Enforcement: ${details.type ?? 'check'}`;
    case 'stake_slashed': return `${name(details.agentId)} stake slashed`;
    case 'rule_changed': return 'Governance rule changed';
    default: return type.replace(/_/g, ' ');
  }
}

function DIDRegistrySection({ agents, history }: { agents: AgentState[]; history?: RoundResult[] }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedDID, setCopiedDID] = useState<string | null>(null);

  // Compute violation counts per agent
  const violationCounts = new Map<string, number>();
  if (history) {
    for (const round of history) {
      for (const event of round.governanceEvents) {
        if (event.type === 'capability_violation' && typeof event.details.agentId === 'string') {
          const count = violationCounts.get(event.details.agentId) ?? 0;
          violationCounts.set(event.details.agentId, count + 1);
        }
      }
    }
  }

  const agentsWithIdentity = agents.filter(a => a.identity);
  const activeCount = agentsWithIdentity.filter(a => !a.identity?.revoked).length;
  const revokedCount = agentsWithIdentity.filter(a => a.identity?.revoked).length;

  const handleCopyDID = (did: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(did).then(() => {
      setCopiedDID(did);
      setTimeout(() => setCopiedDID(null), 1500);
    });
  };

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Fingerprint size={12} weight="duotone" className="text-[var(--info-blue)]" />
        <span className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest flex-1">
          Agent DID Registry
        </span>
        <span className="text-[9px] text-[var(--text-secondary)]">
          <span className="text-[var(--governance-green)]">{activeCount}</span>
          {revokedCount > 0 && (
            <span className="text-[var(--danger-red)] ml-1">/ {revokedCount} revoked</span>
          )}
        </span>
        {expanded ? <CaretUp size={10} className="text-[var(--text-secondary)]" /> : <CaretDown size={10} className="text-[var(--text-secondary)]" />}
      </button>

      {expanded && (
        <div className="space-y-1.5 animate-slide-up">
          {agentsWithIdentity.map(agent => {
            const identity = agent.identity!;
            const violations = violationCounts.get(agent.id) ?? 0;
            const color = PERSONALITY_COLORS[agent.personality] ?? 'var(--text-secondary)';
            const isCopied = copiedDID === identity.did;

            return (
              <div
                key={agent.id}
                className={`rounded-lg border p-2.5 ${
                  identity.revoked
                    ? 'border-[var(--danger-red)]/30 bg-[var(--danger-red)]/5 opacity-60'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: identity.revoked ? 'var(--danger-red)' : color }}
                  />
                  <span className="text-[11px] font-medium text-[var(--text-primary)] flex-1">
                    {agent.name}
                  </span>
                  {identity.revoked && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--danger-red)]/15 text-[var(--danger-red)] font-medium">
                      REVOKED
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[9px] font-mono text-[var(--info-blue)] truncate flex-1">
                    {identity.did}
                  </span>
                  <button
                    onClick={(e) => handleCopyDID(identity.did, e)}
                    className="p-1 rounded hover:bg-[var(--bg-base)] transition-colors"
                    title="Copy DID"
                  >
                    {isCopied ? (
                      <CheckCircle size={10} className="text-[var(--governance-green)]" />
                    ) : (
                      <Copy size={10} className="text-[var(--text-secondary)]" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  {identity.capabilities.map(cap => (
                    <span
                      key={cap}
                      className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--info-blue)]/10 text-[var(--info-blue)]"
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                {violations > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-[var(--border)] text-[9px] text-[var(--danger-red)]">
                    {violations} violation{violations !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FailureModeIndicator({ mode, allModes }: { mode: FailureMode; allModes: FailureMode[] }) {
  const [expanded, setExpanded] = useState(false);
  const color = mode.status === 'critical' ? 'var(--critical-pulse)'
    : mode.status === 'triggered' ? 'var(--danger-red)'
    : 'var(--warning-amber)';

  const cascadeNames = mode.cascadesTo
    .map((id) => allModes.find((fm) => fm.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--bg-elevated)]"
        style={{ borderColor: color, color }}
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${mode.status === 'critical' ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: color }}
        />
        <span className="font-medium">{mode.name}</span>
        <span className="font-mono text-[9px] opacity-70">
          {(mode.severity * 100).toFixed(0)}%
        </span>
      </button>

      {expanded && (
        <div className="mt-1.5 ml-1 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-[10px] space-y-1.5 max-w-xs animate-slide-up">
          <p className="text-[var(--text-secondary)] leading-relaxed">{mode.description}</p>
          {mode.evidence && (
            <p className="text-[var(--text-primary)]">
              <span className="text-[var(--text-secondary)]">Evidence: </span>
              {mode.evidence}
            </p>
          )}
          {mode.roundTriggered !== undefined && (
            <p className="text-[var(--text-secondary)]">
              Triggered year: <span className="font-mono text-[var(--text-primary)]">{mode.roundTriggered}</span>
            </p>
          )}
          {cascadeNames.length > 0 && (
            <p className="text-[var(--text-secondary)]">
              Cascades to: <span className="text-[var(--warning-amber)]">{cascadeNames.join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, actions, attribution }: { agent: AgentState; actions?: AgentAction[]; attribution?: AgentAttribution }) {
  const [expanded, setExpanded] = useState(false);
  const color = PERSONALITY_COLORS[agent.personality] ?? 'var(--text-secondary)';
  const lastConsumed = agent.consumptionHistory[agent.consumptionHistory.length - 1] ?? 0;
  const lastContributed = agent.contributionHistory[agent.contributionHistory.length - 1] ?? 0;
  const primaryAction = actions?.find((a) => a.type === 'consume' || a.type === 'contribute') ?? actions?.[0];

  return (
    <div
      className={`rounded-xl border p-3.5 transition-all duration-200 ${
        agent.excluded
          ? 'opacity-40 border-[var(--danger-red)]/40'
          : 'border-[var(--border)] hover:border-[var(--border)]/80'
      }`}
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <UserCircle size={18} weight="duotone" style={{ color }} />
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {agent.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] capitalize" style={{ color }}>{agent.personality}</span>
              <span className="text-[10px] text-[var(--text-secondary)] opacity-50">|</span>
              <span className="text-[10px] text-[var(--text-secondary)] capitalize">{agent.stakeholder.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {agent.excluded && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--danger-red)]/15 text-[var(--danger-red)] font-medium">
              <XCircle size={10} /> EXCLUDED
            </span>
          )}
          {agent.suspended && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--warning-amber)]/15 text-[var(--warning-amber)] font-medium">
              <Pause size={10} /> SUSPENDED
            </span>
          )}
          {agent.sanctionLevel > 0 && !agent.excluded && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--warning-amber)]/15 text-[var(--warning-amber)] font-medium">
              <WarningCircle size={10} /> LVL {agent.sanctionLevel}
            </span>
          )}
        </div>
      </div>

      {/* Reasoning */}
      {primaryAction && <ReasoningText text={primaryAction.reasoning} />}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 text-xs mb-2.5">
        <StatCell
          icon={<CurrencyEur size={11} weight="bold" />}
          label="Resources"
          value={agent.resources.toFixed(0)}
          color="var(--text-primary)"
        />
        <StatCell
          icon={<ShieldStar size={11} weight="bold" />}
          label="Reputation"
          value={String(agent.reputation)}
          color={agent.reputation > 60 ? 'var(--governance-green)' : agent.reputation > 30 ? 'var(--warning-amber)' : 'var(--danger-red)'}
        />
        <StatCell
          icon={<Coins size={11} weight="bold" />}
          label="Stake"
          value={String(agent.stake)}
          color="var(--stake-gold)"
        />
      </div>

      {/* EUR Impact */}
      {attribution && (
        <div className="grid grid-cols-4 gap-1.5 mb-2.5">
          <div className="px-1.5 py-1 rounded bg-[var(--bg-base)]">
            <div className="text-[7px] uppercase tracking-wider text-[var(--stake-gold)]">Extracted</div>
            <div className="text-[10px] font-mono font-semibold text-[var(--text-primary)]">{formatEUR(attribution.totalExtractedEUR)}</div>
          </div>
          <div className="px-1.5 py-1 rounded bg-[var(--bg-base)]">
            <div className="text-[7px] uppercase tracking-wider text-[var(--governance-green)]">Contributed</div>
            <div className="text-[10px] font-mono font-semibold text-[var(--text-primary)]">{formatEUR(attribution.totalContributedEUR)}</div>
          </div>
          <div className="px-1.5 py-1 rounded bg-[var(--bg-base)]">
            <div className="text-[7px] uppercase tracking-wider text-[var(--warning-amber)]">Externality</div>
            <div className="text-[10px] font-mono font-semibold" style={{ color: attribution.totalExternalityEUR >= 0 ? 'var(--governance-green)' : 'var(--danger-red)' }}>
              {attribution.totalExternalityEUR >= 0 ? '+' : ''}{formatEUR(attribution.totalExternalityEUR)}
            </div>
          </div>
          <div className="px-1.5 py-1 rounded bg-[var(--bg-base)]">
            <div className="text-[7px] uppercase tracking-wider text-[var(--commons-teal)]">Net</div>
            <div className="text-[10px] font-mono font-semibold" style={{ color: attribution.netEconomicImpactEUR >= 0 ? 'var(--governance-green)' : 'var(--danger-red)' }}>
              {attribution.netEconomicImpactEUR >= 0 ? '+' : ''}{formatEUR(attribution.netEconomicImpactEUR)}
            </div>
          </div>
        </div>
      )}

      {/* Last action delta */}
      {(lastConsumed > 0 || lastContributed > 0) && (
        <div className="flex items-center gap-3 text-[10px] mb-2">
          {lastConsumed > 0 && (
            <span className="flex items-center gap-0.5 text-[var(--danger-red)]">
              <TrendDown size={10} /> -{lastConsumed.toFixed(0)}
            </span>
          )}
          {lastContributed > 0 && (
            <span className="flex items-center gap-0.5 text-[var(--governance-green)]">
              <TrendUp size={10} /> +{lastContributed.toFixed(0)}
            </span>
          )}
        </div>
      )}

      {/* Reputation bar */}
      <div className="h-1.5 bg-[var(--bg-base)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${agent.reputation}%`,
            backgroundColor: agent.reputation > 60 ? 'var(--governance-green)' : agent.reputation > 30 ? 'var(--warning-amber)' : 'var(--danger-red)',
          }}
        />
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2.5 text-[10px] text-[var(--commons-teal)] hover:text-[var(--text-primary)] transition-colors"
      >
        {expanded ? 'Hide delegation config' : 'Show delegation config'}
      </button>

      {/* Expandable delegation config */}
      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] space-y-3 animate-slide-up">
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {agent.description}
          </p>
          <div>
            <div className="text-[10px] text-[var(--text-secondary)] mb-1.5 font-medium">Values</div>
            {Object.entries(agent.delegationConfig.values).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-[var(--text-secondary)] w-20 capitalize">{key}</span>
                <div className="flex-1 h-1.5 bg-[var(--bg-base)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${value * 100}%`, backgroundColor: VALUE_COLORS[key] ?? 'var(--text-secondary)' }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[var(--text-secondary)] w-8 text-right">
                  {(value * 100).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
          {agent.delegationConfig.redLines.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--danger-red)] mb-1 font-medium">Red Lines</div>
              <ul className="space-y-1">
                {agent.delegationConfig.redLines.map((line, i) => (
                  <li key={i} className="text-[10px] text-[var(--text-secondary)] flex items-start gap-1.5">
                    <Minus size={8} className="text-[var(--danger-red)] mt-1 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[var(--text-secondary)] mb-0.5">
        {icon}
        <span className="text-[9px]">{label}</span>
      </div>
      <div className="font-mono text-sm font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ReasoningText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <p
      onClick={() => setExpanded(!expanded)}
      className={`text-[11px] italic text-[var(--text-secondary)] mb-3 leading-relaxed cursor-pointer hover:text-[var(--text-primary)] transition-colors ${
        expanded ? '' : 'line-clamp-2'
      }`}
    >
      "{text}"
    </p>
  );
}


function formatEUR(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

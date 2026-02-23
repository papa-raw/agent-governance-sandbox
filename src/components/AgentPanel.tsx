import type { AgentState } from '../types';

const PERSONALITY_COLORS: Record<string, string> = {
  cooperator: 'var(--governance-green)',
  'free-rider': 'var(--danger-red)',
  strategic: 'var(--info-blue)',
  whale: 'var(--stake-gold)',
  chaotic: 'var(--sacred-purple)',
};

interface Props {
  agents: AgentState[];
}

export function AgentPanel({ agents }: Props) {
  if (agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-sm p-4">
        Start a simulation to see agent delegates
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-surface)] p-3">
      <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        Agent Delegates
      </h2>
      <div className="space-y-2">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentState }) {
  const color = PERSONALITY_COLORS[agent.personality] ?? 'var(--text-secondary)';
  const lastConsumed = agent.consumptionHistory[agent.consumptionHistory.length - 1] ?? 0;
  const lastContributed = agent.contributionHistory[agent.contributionHistory.length - 1] ?? 0;

  return (
    <div
      className={`rounded-lg border p-3 transition-opacity ${
        agent.excluded ? 'opacity-40 border-[var(--danger-red)]' : 'border-[var(--border)]'
      }`}
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {agent.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {agent.excluded && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--danger-red)] text-white">
              EXCLUDED
            </span>
          )}
          {agent.suspended && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--warning-amber)] text-[var(--bg-base)]">
              SUSPENDED
            </span>
          )}
          {agent.sanctionLevel > 0 && !agent.excluded && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--warning-amber)] text-[var(--bg-base)]">
              SANCTION {agent.sanctionLevel}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-[var(--text-secondary)]">Resources</div>
          <div className="text-[var(--text-primary)] font-mono">
            {agent.resources.toFixed(0)}
          </div>
        </div>
        <div>
          <div className="text-[var(--text-secondary)]">Reputation</div>
          <div className="font-mono" style={{ color: agent.reputation > 60 ? 'var(--governance-green)' : agent.reputation > 30 ? 'var(--warning-amber)' : 'var(--danger-red)' }}>
            {agent.reputation}
          </div>
        </div>
        <div>
          <div className="text-[var(--text-secondary)]">Stake</div>
          <div className="text-[var(--stake-gold)] font-mono">
            {agent.stake}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-secondary)]">
        <span className="capitalize" style={{ color }}>{agent.personality}</span>
        <span>|</span>
        <span className="capitalize">{agent.stakeholder.replace(/_/g, ' ')}</span>
        <span>|</span>
        <span>
          {lastConsumed > 0 && <span className="text-[var(--danger-red)]">-{lastConsumed.toFixed(0)} </span>}
          {lastContributed > 0 && <span className="text-[var(--governance-green)]">+{lastContributed.toFixed(0)}</span>}
        </span>
      </div>

      {/* Reputation bar */}
      <div className="mt-2 h-1 bg-[var(--bg-base)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${agent.reputation}%`,
            backgroundColor: agent.reputation > 60 ? 'var(--governance-green)' : agent.reputation > 30 ? 'var(--warning-amber)' : 'var(--danger-red)',
          }}
        />
      </div>
    </div>
  );
}

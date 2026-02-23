import type { RoundResult, FailureMode } from '../types';

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  sanction_applied: { icon: '!', color: 'var(--warning-amber)' },
  proposal_created: { icon: 'P', color: 'var(--info-blue)' },
  vote_cast: { icon: 'V', color: 'var(--sacred-purple)' },
  vote_tallied: { icon: 'T', color: 'var(--governance-green)' },
  rule_changed: { icon: 'R', color: 'var(--commons-teal)' },
  agent_excluded: { icon: 'X', color: 'var(--danger-red)' },
  agent_registered: { icon: '+', color: 'var(--governance-green)' },
  agent_suspended: { icon: 'S', color: 'var(--warning-amber)' },
  enforcement_check: { icon: 'E', color: 'var(--info-blue)' },
  stake_slashed: { icon: '$', color: 'var(--stake-gold)' },
  boundary_sealed: { icon: 'B', color: 'var(--commons-teal)' },
  boundary_reopened: { icon: 'B', color: 'var(--governance-green)' },
};

interface Props {
  history: RoundResult[];
  failureModes: FailureMode[];
}

export function GovernanceTimeline({ history, failureModes }: Props) {
  const activeFailureModes = failureModes.filter(
    (fm) => fm.status !== 'inactive',
  );

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] overflow-hidden">
      {/* Failure Mode Indicators */}
      {activeFailureModes.length > 0 && (
        <div className="p-3 border-b border-[var(--border)]">
          <h3 className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Failure Modes
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeFailureModes.map((fm) => (
              <FailureModeIndicator key={fm.id} mode={fm} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-3">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Governance Timeline
        </h2>

        {history.length === 0 ? (
          <div className="text-[var(--text-secondary)] text-sm">
            Events will appear here as the simulation runs
          </div>
        ) : (
          <div className="space-y-1">
            {[...history].reverse().map((round) => (
              <RoundEntry key={round.round} round={round} />
            ))}
          </div>
        )}
      </div>

      {/* Commons health bar */}
      {history.length > 0 && (
        <div className="p-3 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] mb-1">
            <span>Commons Health</span>
            <span>
              Cooperation: {((history[history.length - 1]?.actualCooperationRate ?? 0) * 100).toFixed(0)}%
              {history[history.length - 1]?.replicatorPrediction !== undefined && (
                <span className="ml-1 text-[var(--text-secondary)]">
                  (predicted: {((history[history.length - 1]?.replicatorPrediction ?? 0) * 100).toFixed(0)}%)
                </span>
              )}
            </span>
          </div>
          <CommonsBar history={history} />
          {history[history.length - 1]?.cid && (
            <div className="text-[9px] text-[var(--commons-teal)] font-mono mt-1 truncate" title={history[history.length - 1].cid}>
              CID: {history[history.length - 1].cid}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FailureModeIndicator({ mode }: { mode: FailureMode }) {
  const color = mode.status === 'critical' ? 'var(--critical-pulse)'
    : mode.status === 'triggered' ? 'var(--danger-red)'
    : 'var(--warning-amber)';

  return (
    <div
      className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border"
      style={{ borderColor: color, color }}
    >
      <span
        className={`w-2 h-2 rounded-full ${mode.status === 'critical' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: color }}
      />
      <span>{mode.name}</span>
      <span className="font-mono text-[9px] opacity-70">
        {(mode.severity * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function RoundEntry({ round }: { round: RoundResult }) {
  if (round.governanceEvents.length === 0) return null;

  return (
    <div className="text-[11px]">
      <div className="text-[var(--text-secondary)] font-mono mb-0.5">
        R{round.round}
      </div>
      {round.governanceEvents.map((event, i) => {
        const { icon, color } = EVENT_ICONS[event.type] ?? { icon: '?', color: 'var(--text-secondary)' };
        return (
          <div key={i} className="flex items-start gap-2 ml-3 mb-0.5">
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
              style={{ backgroundColor: color, color: 'var(--bg-base)' }}
            >
              {icon}
            </span>
            <span className="text-[var(--text-primary)]">
              {formatEventDetails(event.type, event.details)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatEventDetails(type: string, details: Record<string, unknown>): string {
  switch (type) {
    case 'sanction_applied':
      return `${details.level ?? 'Sanction'}: ${details.agentId ? String(details.agentId).slice(0, 8) : ''}... — ${details.reason ?? ''}`;
    case 'proposal_created':
      return `Proposal: "${details.description ?? ''}"`;
    case 'vote_cast':
      return `Vote cast by ${details.agentId ? String(details.agentId).slice(0, 8) : ''}...`;
    case 'agent_excluded':
      return `Agent excluded: ${details.reason ?? ''}`;
    case 'agent_suspended':
      return `Agent suspended for ${details.duration ?? '?'} rounds`;
    case 'enforcement_check':
      return `Enforcement check: ${details.type ?? ''}`;
    case 'stake_slashed':
      return `Stake slashed: ${details.amount ?? 0} resources`;
    default:
      return type.replace(/_/g, ' ');
  }
}

function CommonsBar({ history }: { history: RoundResult[] }) {
  // Show last 20 rounds as a mini bar chart
  const recent = history.slice(-20);
  const maxLevel = Math.max(...recent.map((r) => r.commonsLevel), 1);

  return (
    <div className="flex items-end gap-px h-6">
      {recent.map((round) => {
        const height = (round.commonsLevel / maxLevel) * 100;
        const color = height > 60 ? 'var(--governance-green)'
          : height > 30 ? 'var(--warning-amber)'
          : 'var(--danger-red)';
        return (
          <div
            key={round.round}
            className="flex-1 rounded-sm transition-all duration-200"
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

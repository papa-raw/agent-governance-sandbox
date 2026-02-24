import type { SimulationState, GovernanceConfigId } from '../types';
import { GOVERNANCE_PRESETS } from '../engine/governance/presets';
import {
  Play,
  ArrowCounterClockwise,
  Spinner,
  CheckCircle,
  XCircle,
  CalendarBlank,
} from '@phosphor-icons/react';

const CONFIG_SHORT: Record<GovernanceConfigId, string> = {
  tragedy: 'No Governance',
  ostrom: 'Ostrom',
  cybernetic: 'Cybernetic DAO',
  adaptive: 'Camargue',
};

interface Props {
  simulation: SimulationState | null;
  selectedConfig: GovernanceConfigId;
  isRunning: boolean;
  maxYears: number;
  onConfigChange: (id: GovernanceConfigId) => void;
  onStart: () => void;
  onStep: () => void;
  onSkip: () => void;
  onRun: () => void;
  onReset: () => void;
}

export function SimulationControls({
  simulation,
  selectedConfig,
  isRunning,
  maxYears,
  onConfigChange,
  onStart,
  onStep,
  onSkip,
  onRun,
  onReset,
}: Props) {
  const isActive = simulation !== null;
  const isDone = simulation?.status === 'completed' || simulation?.status === 'collapsed';
  const year = simulation?.round ?? 0;
  const progress = year / maxYears;
  const remaining = maxYears - year;

  const statusColor =
    simulation?.status === 'collapsed' ? 'var(--danger-red)'
    : simulation?.status === 'completed' ? 'var(--governance-green)'
    : 'var(--commons-teal)';

  return (
    <div className="flex items-center gap-2">
      {/* Pre-simulation: config selector + start */}
      {!isActive && (
        <>
          <select
            value={selectedConfig}
            onChange={(e) => onConfigChange(e.target.value as GovernanceConfigId)}
            className="text-xs bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] rounded-md px-2 py-1"
          >
            {GOVERNANCE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {CONFIG_SHORT[preset.id as GovernanceConfigId] ?? preset.name}
              </option>
            ))}
          </select>
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 text-xs bg-[var(--governance-green)] text-[var(--bg-base)] font-semibold px-3.5 py-1 rounded-md hover:opacity-90 transition-opacity"
          >
            <Play size={14} weight="fill" />
            Start
          </button>
        </>
      )}

      {/* Active simulation */}
      {isActive && (
        <>
          {/* Config badge */}
          <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded">
            {CONFIG_SHORT[selectedConfig] ?? selectedConfig}
          </span>

          <div className="w-px h-5 bg-[var(--border)]" />

          {/* Year progress */}
          <div className="flex items-center gap-2">
            <CalendarBlank size={14} weight="bold" className="text-[var(--text-secondary)]" />
            <div className="flex flex-col items-start">
              <span className="text-xs font-mono font-semibold text-[var(--text-primary)] tabular-nums leading-none">
                Year {year}
                <span className="text-[var(--text-secondary)] font-normal text-xs"> / {maxYears}</span>
              </span>
              <div className="w-16 h-[3px] bg-[var(--bg-base)] rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress * 100}%`, backgroundColor: statusColor }}
                />
              </div>
            </div>
          </div>

          <div className="w-px h-5 bg-[var(--border)]" />

          {/* Transport: segmented button group */}
          {!isDone && !isRunning && (
            <div className="flex items-center h-7 rounded-md border border-[var(--border)] overflow-hidden text-xs font-mono">
              <button
                onClick={onStep}
                className="h-full px-2.5 text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors border-r border-[var(--border)]"
                title="Advance 1 year"
              >
                +1
              </button>
              {remaining > 2 && (
                <button
                  onClick={onSkip}
                  className="h-full px-2.5 text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors border-r border-[var(--border)]"
                  title={`Advance ${Math.min(5, remaining)} years`}
                >
                  +{Math.min(5, remaining)}
                </button>
              )}
              <button
                onClick={onRun}
                className="h-full px-2.5 font-semibold text-[var(--commons-teal)] bg-[var(--commons-teal)]/8 hover:bg-[var(--commons-teal)]/15 transition-colors"
                title={`Run to year ${maxYears}`}
              >
                →{maxYears}
              </button>
            </div>
          )}

          {/* Running indicator */}
          {!isDone && isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--commons-teal)] font-mono tabular-nums">
              <Spinner size={14} className="animate-spin" />
              Y{year}
            </span>
          )}

          {/* Done badge */}
          {isDone && (
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
              simulation?.status === 'collapsed'
                ? 'bg-[var(--danger-red)]/15 text-[var(--danger-red)]'
                : 'bg-[var(--governance-green)]/15 text-[var(--governance-green)]'
            }`}>
              {simulation?.status === 'collapsed' ? (
                <><XCircle size={13} weight="fill" /> Collapsed</>
              ) : (
                <><CheckCircle size={13} weight="fill" /> Complete</>
              )}
            </span>
          )}

          {/* Reset */}
          <button
            onClick={onReset}
            disabled={isRunning}
            className="flex items-center text-xs text-[var(--danger-red)] p-1 rounded-md hover:bg-[var(--danger-red)]/10 transition-colors disabled:opacity-30"
            title="Reset simulation"
          >
            <ArrowCounterClockwise size={14} weight="bold" />
          </button>
        </>
      )}
    </div>
  );
}

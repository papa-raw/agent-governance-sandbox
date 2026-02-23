import type { SimulationState, GovernanceConfigId } from '../types';
import { GOVERNANCE_PRESETS } from '../engine/governance/presets';

interface Props {
  simulation: SimulationState | null;
  selectedConfig: GovernanceConfigId;
  isRunning: boolean;
  onConfigChange: (id: GovernanceConfigId) => void;
  onStart: () => void;
  onStep: () => void;
  onRun: () => void;
  onReset: () => void;
}

export function SimulationControls({
  simulation,
  selectedConfig,
  isRunning,
  onConfigChange,
  onStart,
  onStep,
  onRun,
  onReset,
}: Props) {
  const isActive = simulation !== null;
  const isDone = simulation?.status === 'completed' || simulation?.status === 'collapsed';

  return (
    <div className="flex items-center gap-3">
      {/* Config selector */}
      <select
        value={selectedConfig}
        onChange={(e) => onConfigChange(e.target.value as GovernanceConfigId)}
        disabled={isActive}
        className="text-sm bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] rounded px-2 py-1 disabled:opacity-50"
      >
        {GOVERNANCE_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>

      {/* Control buttons */}
      {!isActive && (
        <button
          onClick={onStart}
          className="text-sm bg-[var(--governance-green)] text-[var(--bg-base)] font-semibold px-3 py-1 rounded hover:opacity-90 transition-opacity"
        >
          Start
        </button>
      )}

      {isActive && !isDone && (
        <>
          <button
            onClick={onStep}
            disabled={isRunning}
            className="text-sm bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] px-3 py-1 rounded hover:border-[var(--commons-teal)] transition-colors disabled:opacity-50"
          >
            Step
          </button>
          <button
            onClick={onRun}
            disabled={isRunning}
            className="text-sm bg-[var(--commons-teal)] text-[var(--bg-base)] font-semibold px-3 py-1 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isRunning ? 'Running...' : 'Run 50'}
          </button>
        </>
      )}

      {isActive && (
        <button
          onClick={onReset}
          disabled={isRunning}
          className="text-sm bg-[var(--bg-elevated)] text-[var(--danger-red)] border border-[var(--border)] px-3 py-1 rounded hover:border-[var(--danger-red)] transition-colors disabled:opacity-50"
        >
          Reset
        </button>
      )}

      {/* Status indicator */}
      {isActive && (
        <span className={`text-xs px-2 py-0.5 rounded ${
          simulation?.status === 'collapsed'
            ? 'bg-[var(--danger-red)] text-white'
            : simulation?.status === 'completed'
              ? 'bg-[var(--governance-green)] text-[var(--bg-base)]'
              : 'bg-[var(--info-blue)] text-white'
        }`}>
          {simulation?.status === 'collapsed' ? 'COLLAPSED' :
           simulation?.status === 'completed' ? 'COMPLETE' :
           `R${simulation?.round}`}
        </span>
      )}
    </div>
  );
}

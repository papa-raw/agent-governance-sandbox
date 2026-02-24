import { useState, useEffect } from 'react';
import { GOVERNANCE_PRESETS } from '../engine/governance/presets';
import { CAMARGUE_AGENTS } from '../engine/agents';
import type { AgentTemplate } from '../engine/agents';
import type { GovernanceConfigId, DelegationConfig } from '../types';
import {
  GlobeHemisphereWest,
  Scales,
  UserCircle,
  ShieldCheck,
  Gavel,
  HandCoins,
  Coins,
  CheckSquareOffset,
  Lock,
  ProhibitInset,
  Play,
  Sliders,
  Minus,
  HardDrives,
  Brain,
  CaretDown,
  CaretUp,
  X,
  Graph,
  Skull,
  TreeStructure,
  MapTrifold,
  Users,
  Timer,
  Leaf,
  CurrencyEur,
} from '@phosphor-icons/react';

const PERSONALITY_COLORS: Record<string, string> = {
  cooperator: 'var(--governance-green)',
  'free-rider': 'var(--danger-red)',
  strategic: 'var(--info-blue)',
  whale: 'var(--stake-gold)',
  chaotic: 'var(--sacred-purple)',
};

const VALUE_LABELS: Record<string, { color: string; description: string }> = {
  environment: { color: 'var(--governance-green)', description: 'Conservation priority' },
  equity: { color: 'var(--sacred-purple)', description: 'Fair distribution' },
  growth: { color: 'var(--stake-gold)', description: 'Economic output' },
  stability: { color: 'var(--info-blue)', description: 'System predictability' },
};

const GOVERNANCE_ICONS: Record<string, React.ReactNode> = {
  tragedy: <Skull size={18} weight="duotone" />,
  ostrom: <TreeStructure size={18} weight="duotone" />,
  cybernetic: <Graph size={18} weight="duotone" />,
  adaptive: <MapTrifold size={18} weight="duotone" />,
};

const GOVERNANCE_SHORT_NAMES: Record<string, string> = {
  tragedy: 'Tragedy',
  ostrom: 'Ostrom',
  cybernetic: 'Cybernetic DAO',
  adaptive: 'Camargue',
};

const GOVERNANCE_OUTCOMES: Record<string, { label: string; color: string }> = {
  tragedy: { label: 'Collapse', color: 'var(--danger-red)' },
  ostrom: { label: 'Sustainable', color: 'var(--governance-green)' },
  cybernetic: { label: 'Self-Regulating', color: 'var(--info-blue)' },
  adaptive: { label: 'Adaptive', color: 'var(--commons-teal)' },
};

const DELEGATION_GROUPS = [
  { label: 'Conservation', filter: (a: AgentTemplate) => ['conservationist', 'public_landowner'].includes(a.stakeholder) },
  { label: 'Primary Producers', filter: (a: AgentTemplate) => ['rice_farmer', 'salt_producer', 'rancher', 'fisher'].includes(a.stakeholder) },
  { label: 'Extractive & Services', filter: (a: AgentTemplate) => ['hunter', 'tourism_developer'].includes(a.stakeholder) },
  { label: 'Governance Bodies', filter: (a: AgentTemplate) => ['park_authority', 'municipality', 'water_authority', 'regional_government'].includes(a.stakeholder) },
];

interface Props {
  selectedConfig: GovernanceConfigId;
  onConfigChange: (id: GovernanceConfigId) => void;
  onStart: (customizedAgents?: AgentTemplate[]) => void;
}

function deepCloneTemplates(templates: readonly AgentTemplate[]): AgentTemplate[] {
  return templates.map((t) => ({
    ...t,
    delegationConfig: {
      ...t.delegationConfig,
      values: { ...t.delegationConfig.values },
      redLines: [...t.delegationConfig.redLines],
      authorityBounds: { ...t.delegationConfig.authorityBounds },
    },
  }));
}

export function IntroPanel({ selectedConfig, onConfigChange, onStart }: Props) {
  const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>(() =>
    deepCloneTemplates(CAMARGUE_AGENTS),
  );
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const [schematicModal, setSchematicModal] = useState(false);
  const [delegationTab, setDelegationTab] = useState(DELEGATION_GROUPS[0].label);
  const [bgLoaded, setBgLoaded] = useState(false);

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/images/camargue-intro.jpg';
  }, []);

  const updateValue = (agentIndex: number, key: keyof DelegationConfig['values'], value: number) => {
    setAgentTemplates((prev) => {
      const next = deepCloneTemplates(prev);
      next[agentIndex].delegationConfig.values[key] = value;
      return next;
    });
  };

  const hasCustomizations = agentTemplates.some((t, i) => {
    const orig = CAMARGUE_AGENTS[i];
    if (!orig) return false;
    return (
      t.delegationConfig.values.environment !== orig.delegationConfig.values.environment ||
      t.delegationConfig.values.equity !== orig.delegationConfig.values.equity ||
      t.delegationConfig.values.growth !== orig.delegationConfig.values.growth ||
      t.delegationConfig.values.stability !== orig.delegationConfig.values.stability
    );
  });

  const activePreset = GOVERNANCE_PRESETS.find((p) => p.id === selectedConfig) ?? GOVERNANCE_PRESETS[1];
  const activeGroup = DELEGATION_GROUPS.find((g) => g.label === delegationTab) ?? DELEGATION_GROUPS[0];
  const groupAgents = agentTemplates.map((a, i) => ({ agent: a, idx: i })).filter(({ agent }) => activeGroup.filter(agent));

  return (
    <div className="h-full grid grid-cols-[1fr_360px] bg-[var(--bg-surface)]">
      {/* ── LEFT COLUMN — scrollable config ── */}
      <div className="h-full overflow-y-auto p-5 space-y-5">
        {/* Hero block with background image */}
        <div className="relative rounded-xl overflow-hidden">
          {/* Background image */}
          <div
            className={`absolute inset-0 transition-opacity duration-1000 ${bgLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'url(/images/camargue-intro.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center 40%',
            }}
          />
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/70 to-transparent" />
          {/* Fallback dark bg when image hasn't loaded */}
          {!bgLoaded && <div className="absolute inset-0 bg-[var(--bg-base)]" />}

          <div className="relative px-5 pt-28 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <GlobeHemisphereWest size={20} weight="duotone" className="text-[var(--commons-teal)]" />
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                Agent Governance Sandbox
              </h1>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-xl">
              Twelve AI delegates govern the Camargue delta — 101,000 hectares of contested wetlands,
              lagoons, and farmland. Choose a governance model, configure your delegates, and watch
              institutions shape cooperation or collapse without them.
            </p>
          </div>
        </div>

        {/* Governance model selection — visually distinct cards */}
        <div>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2.5">
            <Scales size={12} weight="bold" className="opacity-60" />
            Governance Model
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {GOVERNANCE_PRESETS.map((preset) => {
              const outcome = GOVERNANCE_OUTCOMES[preset.id];
              const isActive = preset.id === selectedConfig;
              return (
                <button
                  key={preset.id}
                  onClick={() => onConfigChange(preset.id)}
                  className={`rounded-lg p-3 text-left transition-all border ${
                    isActive
                      ? 'border-[var(--commons-teal)] bg-[var(--bg-base)] shadow-[0_0_12px_rgba(26,188,156,0.15)]'
                      : 'border-[var(--border)] bg-[var(--bg-base)] hover:border-[var(--text-secondary)]/30'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={isActive ? 'text-[var(--commons-teal)]' : 'text-[var(--text-secondary)]'}>
                      {GOVERNANCE_ICONS[preset.id]}
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                      {GOVERNANCE_SHORT_NAMES[preset.id]}
                    </span>
                  </div>
                  <span
                    className="text-[9px] font-mono uppercase tracking-wider"
                    style={{ color: outcome.color }}
                  >
                    {outcome.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active model detail card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[var(--commons-teal)]">{GOVERNANCE_ICONS[selectedConfig]}</span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {activePreset.name}
              </h3>
            </div>
            <button
              onClick={() => setSchematicModal(true)}
              className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--commons-teal)] transition-colors px-2 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--commons-teal)] bg-[var(--bg-surface)]"
              title="View governance schematic"
            >
              <Graph size={12} weight="bold" />
              Schematic
            </button>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-3">
            {activePreset.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activePreset.boundaryRules.enabled && (
              <MechanismTag icon={<ShieldCheck size={9} weight="bold" />} label="Boundaries" />
            )}
            {activePreset.contributionRequirements.enabled && (
              <MechanismTag icon={<HandCoins size={9} weight="bold" />} label={`${activePreset.contributionRequirements.minContributionPercent}% min contribution`} />
            )}
            {activePreset.graduatedSanctions.enabled && (
              <MechanismTag icon={<Gavel size={9} weight="bold" />} label="Graduated sanctions" />
            )}
            {activePreset.collectiveChoice.enabled && (
              <MechanismTag icon={<CheckSquareOffset size={9} weight="bold" />} label={`${activePreset.collectiveChoice.votingMethod.replace(/_/g, ' ')} voting`} />
            )}
            {activePreset.collectiveChoice.enabled && activePreset.collectiveChoice.ballotPrivacy === 'threshold_disclosure' && (
              <MechanismTag icon={<Lock size={9} weight="bold" />} label="Lit Protocol encrypted ballots" highlight />
            )}
            {activePreset.validationStaking.enabled && (
              <MechanismTag icon={<Coins size={9} weight="bold" />} label="Staking" />
            )}
            {!activePreset.boundaryRules.enabled && !activePreset.contributionRequirements.enabled &&
             !activePreset.graduatedSanctions.enabled && !activePreset.collectiveChoice.enabled &&
             !activePreset.validationStaking.enabled && (
              <MechanismTag icon={<ProhibitInset size={9} weight="bold" />} label="No rules" warning />
            )}
          </div>
        </div>

        {/* Delegation Console with tabs */}
        <div>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
            <Sliders size={12} weight="bold" className="opacity-60" />
            Delegation Console
          </h3>
          <p className="text-[11px] text-[var(--text-secondary)] mb-3">
            Configure each delegate's values, red lines, and authority bounds.
          </p>

          {/* Delegation group tabs — compact style distinct from governance model cards */}
          <div className="flex gap-1 mb-3 p-0.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] w-fit">
            {DELEGATION_GROUPS.map((group) => (
              <button
                key={group.label}
                onClick={() => { setDelegationTab(group.label); setExpandedAgent(null); }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  delegationTab === group.label
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {group.label.replace('Extractive & Services', 'Extractive')}
              </button>
            ))}
          </div>

          {/* Active group agents */}
          <div className="space-y-2">
            {groupAgents.map(({ agent, idx: agentIdx }, listIdx) => {
              const color = PERSONALITY_COLORS[agent.personality] ?? 'var(--text-secondary)';
              // Pre-expand first agent in group
              const isExpanded = expandedAgent === agentIdx || (expandedAgent === null && listIdx === 0);
              return (
                <div
                  key={agent.name}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedAgent(isExpanded ? -1 : agentIdx)}
                    className="w-full text-left p-3 hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCircle size={16} weight="duotone" style={{ color }} />
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                          {agent.name}
                        </span>
                        <span className="text-[10px] capitalize" style={{ color }}>
                          {agent.personality}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Mini value bars on collapsed cards */}
                        {!isExpanded && (
                          <div className="flex gap-0.5">
                            {(Object.entries(agent.delegationConfig.values) as [string, number][]).map(([key, val]) => (
                              <div
                                key={key}
                                className="w-1 rounded-full"
                                style={{
                                  height: `${Math.max(4, val * 16)}px`,
                                  backgroundColor: VALUE_LABELS[key]?.color ?? 'var(--text-secondary)',
                                  opacity: 0.6,
                                }}
                              />
                            ))}
                          </div>
                        )}
                        {isExpanded ? (
                          <CaretUp size={12} className="text-[var(--text-secondary)]" />
                        ) : (
                          <CaretDown size={12} className="text-[var(--text-secondary)]" />
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                      {agent.description}
                    </p>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-[var(--border)] pt-3 space-y-3 animate-slide-up">
                      <div>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-2">
                          <Sliders size={10} weight="bold" className="opacity-60" />
                          Values (0-100)
                        </div>
                        {(Object.entries(agent.delegationConfig.values) as [keyof DelegationConfig['values'], number][]).map(
                          ([key, value]) => {
                            const meta = VALUE_LABELS[key];
                            return (
                              <div key={key} className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] text-[var(--text-secondary)] w-20 capitalize">{key}</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={Math.round(value * 100)}
                                  onChange={(e) => updateValue(agentIdx, key, Number(e.target.value) / 100)}
                                  className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
                                  style={{ background: `linear-gradient(to right, ${meta.color} ${value * 100}%, var(--bg-elevated) ${value * 100}%)` }}
                                />
                                <span className="text-[10px] font-mono text-[var(--text-primary)] w-8 text-right">{Math.round(value * 100)}</span>
                              </div>
                            );
                          },
                        )}
                      </div>
                      {agent.delegationConfig.redLines.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--danger-red)] uppercase mb-1.5">
                            <ProhibitInset size={10} weight="bold" />
                            Red Lines
                          </div>
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
                      <div>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--commons-teal)] uppercase mb-1.5">
                          <ShieldCheck size={10} weight="bold" />
                          Authority Bounds
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-[var(--text-secondary)]">
                          <span>Max consume: <span className="font-mono text-[var(--text-primary)]">{agent.delegationConfig.authorityBounds.maxConsume}</span></span>
                          <span>Max stake: <span className="font-mono text-[var(--text-primary)]">{(agent.delegationConfig.authorityBounds.maxStakeRatio * 100).toFixed(0)}%</span></span>
                          <span>Can propose: <span className="font-mono text-[var(--text-primary)]">{agent.delegationConfig.authorityBounds.canPropose ? 'yes' : 'no'}</span></span>
                          <span>Can vote to exclude: <span className="font-mono text-[var(--text-primary)]">{agent.delegationConfig.authorityBounds.canVoteToExclude ? 'yes' : 'no'}</span></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN — territory context + start ── */}
      <div className="h-full flex flex-col border-l border-[var(--border)] bg-[var(--bg-base)]">
        {/* Territory stakes */}
        <div className="p-5 space-y-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Territory at Stake
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--stake-gold)]/10 flex items-center justify-center">
                  <CurrencyEur size={16} weight="duotone" className="text-[var(--stake-gold)]" />
                </div>
                <div>
                  <div className="text-[15px] font-bold font-mono text-[var(--text-primary)]">360-610M</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">€/yr commodity production</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--governance-green)]/10 flex items-center justify-center">
                  <Leaf size={16} weight="duotone" className="text-[var(--governance-green)]" />
                </div>
                <div>
                  <div className="text-[15px] font-bold font-mono text-[var(--text-primary)]">2.3B</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">€/yr ecosystem services</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--commons-teal)]/10 flex items-center justify-center">
                  <GlobeHemisphereWest size={16} weight="duotone" className="text-[var(--commons-teal)]" />
                </div>
                <div>
                  <div className="text-[15px] font-bold font-mono text-[var(--text-primary)]">101,000 ha</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">UNESCO Biosphere Reserve</div>
                </div>
              </div>
            </div>
          </div>

          {/* Simulation preview */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-2">What to expect</div>
            <div className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Users size={12} className="text-[var(--info-blue)] shrink-0" />
                <span>12 AI delegates deliberate and vote</span>
              </div>
              <div className="flex items-center gap-2">
                <Timer size={12} className="text-[var(--commons-teal)] shrink-0" />
                <span>50 rounds of resource governance</span>
              </div>
              <div className="flex items-center gap-2">
                <Leaf size={12} className="text-[var(--governance-green)] shrink-0" />
                <span>Real € ecosystem valuation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Built With */}
        <div className="p-5 border-t border-[var(--border)]">
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--bg-surface)]">
            <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Built With
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2.5">
                <HardDrives size={16} weight="duotone" className="text-[var(--commons-teal)] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12px] text-[var(--commons-teal)] font-semibold">Storacha</div>
                  <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed">CID-rooted audit trail</div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Lock size={16} weight="duotone" className="text-[var(--sacred-purple)] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12px] text-[var(--sacred-purple)] font-semibold">Lit Protocol</div>
                  <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed">Threshold-disclosure voting</div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Brain size={16} weight="duotone" className="text-[var(--info-blue)] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12px] text-[var(--info-blue)] font-semibold">Claude (Anthropic)</div>
                  <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed">Constrained AI delegates</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Start button — anchored at bottom */}
        <div className="p-5 pt-0">
          <button
            onClick={() => onStart(hasCustomizations ? agentTemplates : undefined)}
            className="w-full flex items-center justify-center gap-2 text-sm bg-[var(--governance-green)] text-[var(--bg-base)] font-semibold px-4 py-3.5 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(46,204,113,0.25)] cursor-pointer"
          >
            <Play size={14} weight="fill" />
            {hasCustomizations ? 'Start with Custom Delegates' : 'Start Simulation'}
          </button>
          {hasCustomizations && (
            <p className="text-[10px] text-[var(--commons-teal)] text-center mt-1.5">
              Delegate values customized
            </p>
          )}
        </div>
      </div>

      {/* ── SCHEMATIC MODAL ── */}
      {schematicModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSchematicModal(false)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[var(--commons-teal)]">{GOVERNANCE_ICONS[selectedConfig]}</span>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {activePreset.name}
                </h3>
              </div>
              <button
                onClick={() => setSchematicModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-elevated)]"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <img
              src={`/schematics/${selectedConfig}.png`}
              alt={`${activePreset.name} governance schematic`}
              className="max-w-[80vw] max-h-[75vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MechanismTag({ icon, label, warning, highlight }: { icon?: React.ReactNode; label: string; warning?: boolean; highlight?: boolean }) {
  return (
    <span
      className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md ${
        warning
          ? 'bg-[var(--danger-red)]/15 text-[var(--danger-red)]'
          : highlight
            ? 'bg-[var(--sacred-purple)]/15 text-[var(--sacred-purple)]'
            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

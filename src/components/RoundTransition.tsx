import { useEffect, useState, useRef } from 'react';
import {
  TreeEvergreen,
  Handshake,
  Warning,
  TrendUp,
  TrendDown,
  Leaf,
  Drop,
  PawPrint,
  Timer,
  Quotes,
  BookOpen,
  Lightning,
  CaretDown,
  CaretUp,
  ArrowRight,
} from '@phosphor-icons/react';
import type { RoundResult, AgentAction } from '../types';

const PERSONALITY_COLORS: Record<string, string> = {
  cooperator: 'var(--governance-green)',
  'free-rider': 'var(--danger-red)',
  strategic: 'var(--info-blue)',
  whale: 'var(--stake-gold)',
  chaotic: 'var(--sacred-purple)',
};

interface Props {
  current: RoundResult;
  previous: RoundResult | null;
  onDismiss: () => void;
  autoMs?: number;
  agents?: Array<{ id: string; name: string; personality: string }>;
}

export function RoundTransition({ current, previous, onDismiss, autoMs = 45000, agents }: Props) {
  const [visible, setVisible] = useState(true);
  const [remaining, setRemaining] = useState(Math.ceil(autoMs / 1000));
  const [voicesOpen, setVoicesOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, autoMs);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoMs, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeout(onDismiss, 300);
  };

  // Compute deltas
  const commonsDelta = previous
    ? current.commonsLevel - previous.commonsLevel
    : 0;
  const commonsPct = previous && previous.commonsLevel > 0
    ? (commonsDelta / previous.commonsLevel) * 100
    : 0;

  const ecoValue = current.territorySnapshot.totalEcosystemValue;
  const prevEcoValue = previous?.territorySnapshot.totalEcosystemValue;
  const ecoDelta = ecoValue != null && prevEcoValue != null
    ? ecoValue - prevEcoValue
    : null;
  const ecoPct = ecoDelta != null && prevEcoValue && prevEcoValue > 0
    ? (ecoDelta / prevEcoValue) * 100
    : null;

  const cooperation = current.actualCooperationRate ?? 0;

  const activeFailures = current.failureModes.filter(
    (fm) => fm.status === 'triggered' || fm.status === 'critical',
  );

  const greenAssets = current.territorySnapshot.greenAssets;
  const carbonCredits = greenAssets?.assets.find(a => a.assetClass === 'carbon_credit');
  const bioCredits = greenAssets?.assets.find(a => a.assetClass === 'biodiversity_credit');

  const insights = synthesizeDiscourse(current.actions, agents);
  const quotes = getTopQuotes(current.actions, agents);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 glass-heavy" />

      {/* Content — centered, compact, no scroll */}
      <div className="relative w-full max-w-2xl mx-6 animate-scale-in">

        {/* Year number */}
        <div className="text-center mb-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-secondary)] mb-1.5">
            Year Complete
          </div>
          <div className="text-5xl font-bold text-[var(--text-primary)] tabular-nums">
            {current.round}
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3 mb-5 stagger-children">
          <MetricCard
            icon={<TreeEvergreen size={18} weight="duotone" />}
            label="Commons"
            value={formatCompact(current.commonsLevel)}
            delta={commonsPct}
            color="var(--commons-teal)"
          />
          <MetricCard
            icon={<Leaf size={18} weight="duotone" />}
            label="Ecosystem"
            value={ecoValue != null ? `${formatEUR(ecoValue)}/yr` : '—'}
            delta={ecoPct}
            color="var(--governance-green)"
          />
          <MetricCard
            icon={<Handshake size={18} weight="duotone" />}
            label="Cooperation"
            value={`${(cooperation * 100).toFixed(0)}%`}
            color="var(--info-blue)"
          />
        </div>

        {/* Green assets — compact inline */}
        {greenAssets && (carbonCredits || bioCredits) && (
          <div className="glass rounded-lg p-3.5 mb-4 animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-5 justify-center flex-wrap">
              <span className="text-[9px] uppercase tracking-widest text-[var(--text-secondary)]">Green Assets</span>
              {carbonCredits && carbonCredits.currentUnits > 0 && (
                <div className="flex items-center gap-1.5">
                  <Drop size={14} weight="duotone" className="text-[var(--eco-carbon)]" />
                  <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                    {formatCompact(carbonCredits.currentUnits)}
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)]">tCO2e</span>
                </div>
              )}
              {bioCredits && bioCredits.currentUnits > 0 && (
                <div className="flex items-center gap-1.5">
                  <PawPrint size={14} weight="duotone" className="text-[var(--eco-bio)]" />
                  <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                    {formatCompact(bioCredits.currentUnits)}
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)]">ha-eq</span>
                </div>
              )}
              {greenAssets.lostPotentialEUR > 1000 && (
                <div className="flex items-center gap-1.5">
                  <Warning size={14} weight="duotone" className="text-[var(--warning-amber)]" />
                  <span className="text-xs font-bold font-mono text-[var(--warning-amber)]">
                    -{formatEUR(greenAssets.lostPotentialEUR)}
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)]">eroded</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Discourse insights — synthesized from agent reasoning */}
        {insights.length > 0 && (
          <div className="glass rounded-lg p-4 mb-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Lightning size={14} weight="duotone" className="text-[var(--warning-amber)]" />
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Discourse</span>
            </div>
            <div className="space-y-1.5">
              {insights.map((insight, i) => (
                <p key={i} className="text-[12px] text-[var(--text-primary)] leading-relaxed">
                  <span className="text-[var(--text-secondary)] mr-1">{insight.icon}</span>
                  {insight.text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Agent Voices — collapsible */}
        {quotes.length > 0 && (
          <div className="glass rounded-lg mb-4 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <button
              className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setVoicesOpen(!voicesOpen); }}
            >
              <div className="flex items-center gap-1.5">
                <Quotes size={14} weight="duotone" className="text-[var(--sacred-purple)]" />
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  Agent Voices ({quotes.length})
                </span>
              </div>
              {voicesOpen
                ? <CaretUp size={14} className="text-[var(--text-secondary)]" />
                : <CaretDown size={14} className="text-[var(--text-secondary)]" />
              }
            </button>
            {voicesOpen && (
              <div className="px-4 pb-4 space-y-2.5 max-h-48 overflow-y-auto">
                {quotes.map((q, i) => (
                  <div key={i} className="text-[11px] leading-relaxed">
                    <span className="italic text-[var(--text-secondary)]">"{q.reasoning}"</span>
                    <span className="text-[10px] ml-1.5" style={{ color: q.color }}>— {q.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Failure mode alerts */}
        {activeFailures.length > 0 && (
          <div className="space-y-2 mb-4 animate-slide-up" style={{ animationDelay: '350ms' }}>
            {activeFailures.map((fm) => (
              <div
                key={fm.id}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg"
                style={{
                  background: fm.status === 'critical'
                    ? 'rgba(255, 23, 68, 0.15)'
                    : 'rgba(231, 76, 60, 0.1)',
                  border: `1px solid ${fm.status === 'critical' ? 'var(--critical-pulse)' : 'var(--danger-red)'}`,
                }}
              >
                <Warning
                  size={16}
                  weight="fill"
                  className={fm.status === 'critical' ? 'text-[var(--critical-pulse)] animate-pulse' : 'text-[var(--danger-red)]'}
                />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[var(--text-primary)]">{fm.name}</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">{fm.evidence}</div>
                </div>
                <div className="text-xs font-mono" style={{
                  color: fm.status === 'critical' ? 'var(--critical-pulse)' : 'var(--danger-red)',
                }}>
                  {(fm.severity * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Continue button + timer */}
        <div className="flex items-center justify-between mt-5 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div className="text-[9px] text-[var(--text-secondary)] leading-relaxed max-w-[50%]">
            <BookOpen size={9} className="inline mr-1 opacity-60" />
            Costanza et al. 2014, Med-ESCWET, SRFF
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
              <Timer size={11} className="opacity-60" />
              <span className="font-mono tabular-nums">{remaining}s</span>
              <div className="w-16 h-0.5 bg-[var(--bg-base)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-linear bg-[var(--commons-teal)]"
                  style={{ width: `${(remaining / Math.ceil(autoMs / 1000)) * 100}%` }}
                />
              </div>
            </div>
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer
                         bg-[var(--commons-teal)] text-[var(--bg-base)] hover:brightness-110 transition-all"
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            >
              Continue
              <ArrowRight size={13} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  delta,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  color: string;
}) {
  return (
    <div className="glass rounded-lg p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1.5" style={{ color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono text-[var(--text-primary)] mb-0.5 animate-count-up">
        {value}
      </div>
      {delta != null && Math.abs(delta) > 0.5 && (
        <div className="flex items-center justify-center gap-0.5 text-xs font-mono" style={{
          color: delta > 0 ? 'var(--governance-green)' : 'var(--danger-red)',
        }}>
          {delta > 0 ? <TrendUp size={12} /> : <TrendDown size={12} />}
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatEUR(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

/**
 * Synthesize discourse insights from agent actions.
 * Extracts thematic tensions instead of showing raw quotes.
 */
function synthesizeDiscourse(
  actions: AgentAction[],
  agents?: Array<{ id: string; name: string; personality: string }>,
): Array<{ icon: string; text: string }> {
  const agentMap = new Map(agents?.map((a) => [a.id, a]) ?? []);
  const insights: Array<{ icon: string; text: string }> = [];

  const consumers = actions.filter(a => a.type === 'consume' && a.amount);
  const contributors = actions.filter(a => a.type === 'contribute' && a.amount);
  const totalExtracted = consumers.reduce((s, a) => s + (a.amount ?? 0), 0);
  const totalContributed = contributors.reduce((s, a) => s + (a.amount ?? 0), 0);

  // Extraction vs contribution balance
  if (consumers.length > 0 && contributors.length > 0) {
    const ratio = totalExtracted / Math.max(totalContributed, 1);
    if (ratio > 3) {
      insights.push({
        icon: '\u26A0',
        text: `Extraction outpaces investment ${ratio.toFixed(1)}:1 — ${consumers.length} agents drew ${formatCompact(totalExtracted)} units while only ${formatCompact(totalContributed)} returned.`,
      });
    } else if (ratio > 1.5) {
      insights.push({
        icon: '\u2194',
        text: `Net draw of ${formatCompact(totalExtracted - totalContributed)} units — ${consumers.length} extracting, ${contributors.length} investing.`,
      });
    } else {
      insights.push({
        icon: '\u2713',
        text: `Near-balance: ${formatCompact(totalExtracted)} extracted vs ${formatCompact(totalContributed)} invested across ${actions.length} actions.`,
      });
    }
  } else if (consumers.length > 0) {
    insights.push({
      icon: '\u26A0',
      text: `All ${consumers.length} active agents extracted (${formatCompact(totalExtracted)} units) — no investment this year.`,
    });
  }

  // Personality faction analysis
  const factions = new Map<string, { count: number; extracting: number; contributing: number }>();
  for (const action of actions) {
    const agent = agentMap.get(action.agentId);
    if (!agent) continue;
    const p = agent.personality;
    if (!factions.has(p)) factions.set(p, { count: 0, extracting: 0, contributing: 0 });
    const f = factions.get(p)!;
    f.count++;
    if (action.type === 'consume') f.extracting += action.amount ?? 0;
    if (action.type === 'contribute') f.contributing += action.amount ?? 0;
  }

  // Identify defectors among cooperators or cooperation among free-riders
  const cooperatorFaction = factions.get('cooperator');
  if (cooperatorFaction && cooperatorFaction.extracting > cooperatorFaction.contributing) {
    insights.push({
      icon: '\u21C4',
      text: 'Cooperators shifted toward extraction this year — resource pressure may be forcing pragmatism.',
    });
  }

  const freeRiderFaction = factions.get('free-rider');
  if (freeRiderFaction && freeRiderFaction.contributing > 0) {
    insights.push({
      icon: '\u2737',
      text: 'Free-riders contributed resources — governance pressure or strategic repositioning may be at play.',
    });
  }

  // Reasoning theme extraction — scan for common concerns
  const allReasoning = actions
    .filter(a => a.reasoning && a.reasoning.length > 10)
    .map(a => a.reasoning.toLowerCase());

  if (allReasoning.length > 0) {
    const themes: Array<{ pattern: RegExp; label: string; icon: string }> = [
      { pattern: /sustainab|deplet|collaps|degrad/, label: 'sustainability concerns', icon: '\uD83C\uDF3F' },
      { pattern: /govern|rule|sanction|enforce|penalt/, label: 'governance friction', icon: '\u2696' },
      { pattern: /trust|cooperat|solidar|collective/, label: 'calls for cooperation', icon: '\uD83E\uDD1D' },
      { pattern: /profit|revenue|economic|market|cost/, label: 'economic pressures', icon: '\uD83D\uDCB0' },
    ];

    const detected = themes.filter(t =>
      allReasoning.filter(r => t.pattern.test(r)).length >= 2,
    );

    if (detected.length > 0) {
      insights.push({
        icon: '\uD83D\uDDE3',
        text: `Dominant themes: ${detected.map(d => d.label).join(', ')}.`,
      });
    }
  }

  return insights.slice(0, 3);
}

/**
 * Get top 3-4 agent quotes prioritized by: sanctioned > top consumer > top contributor.
 */
function getTopQuotes(
  actions: AgentAction[],
  agents?: Array<{ id: string; name: string; personality: string }>,
): Array<{ name: string; reasoning: string; color: string }> {
  const agentMap = new Map(agents?.map((a) => [a.id, a]) ?? []);

  const scored = actions
    .filter((a) => a.reasoning && a.reasoning.length > 10)
    .map((a) => {
      const agent = agentMap.get(a.agentId);
      const score =
        (a.type === 'consume' ? (a.amount ?? 0) * 2 : 0) +
        (a.type === 'contribute' ? (a.amount ?? 0) * 1.5 : 0) +
        (a.type === 'propose_rule' ? 50 : 0);
      return {
        name: agent?.name ?? 'Unknown',
        reasoning: a.reasoning,
        color: PERSONALITY_COLORS[agent?.personality ?? ''] ?? 'var(--text-secondary)',
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 4);
}

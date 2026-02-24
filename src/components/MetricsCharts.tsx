import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import {
  TreeEvergreen,
  Leaf,
  Handshake,
  CurrencyEur,
  ChartLineUp,
} from '@phosphor-icons/react';
import type { RoundResult } from '../types';

interface Props {
  history: RoundResult[];
}

export function MetricsCharts({ history }: Props) {
  const chartData = useMemo(() => {
    return history.map((r) => ({
      round: r.round,
      commons: r.commonsLevel,
      ecosystem: r.territorySnapshot.totalEcosystemValue ?? 0,
      commodity: r.territorySnapshot.totalCommodityValue ?? 0,
      cooperation: (r.actualCooperationRate ?? 0) * 100,
      prediction: (r.replicatorPrediction ?? 0) * 100,
      biodiversity: r.territorySnapshot.biodiversityIndex,
      sustainability: r.territorySnapshot.sustainabilityScore,
      gini: r.territorySnapshot.giniCoefficient,
    }));
  }, [history]);

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-xs">
        <ChartLineUp size={16} className="mr-2 opacity-50" />
        Charts appear after 2+ rounds
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {/* Commons + Ecosystem dual area chart */}
      <ChartCard
        icon={<TreeEvergreen size={14} weight="duotone" />}
        label="Commons & Ecosystem Value"
        color="var(--commons-teal)"
      >
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="round" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} width={36} tickFormatter={compactNum} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="commons"
              stroke="var(--commons-teal)"
              fill="var(--commons-teal)"
              fillOpacity={0.15}
              strokeWidth={1.5}
              name="Commons"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Ecosystem value over time */}
      {chartData[0].ecosystem > 0 && (
        <ChartCard
          icon={<Leaf size={14} weight="duotone" />}
          label="Ecosystem Services (€/yr)"
          color="var(--governance-green)"
        >
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="round" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} width={40} tickFormatter={compactEUR} />
              <Tooltip content={<CustomTooltip eurFields={['ecosystem', 'commodity']} />} />
              <Area
                type="monotone"
                dataKey="ecosystem"
                stroke="var(--governance-green)"
                fill="var(--governance-green)"
                fillOpacity={0.15}
                strokeWidth={1.5}
                name="Ecosystem"
              />
              <Area
                type="monotone"
                dataKey="commodity"
                stroke="var(--stake-gold)"
                fill="var(--stake-gold)"
                fillOpacity={0.08}
                strokeWidth={1}
                strokeDasharray="4 2"
                name="Commodity"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Cooperation rate vs prediction */}
      <ChartCard
        icon={<Handshake size={14} weight="duotone" />}
        label="Cooperation Rate"
        color="var(--info-blue)"
      >
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="round" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} width={28} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip pctFields={['cooperation', 'prediction']} />} />
            <Line
              type="monotone"
              dataKey="cooperation"
              stroke="var(--info-blue)"
              strokeWidth={1.5}
              dot={false}
              name="Actual"
            />
            <Line
              type="monotone"
              dataKey="prediction"
              stroke="var(--sacred-purple)"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              name="Predicted"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Biodiversity + Sustainability */}
      <ChartCard
        icon={<CurrencyEur size={14} weight="duotone" />}
        label="Sustainability & Gini"
        color="var(--warning-amber)"
      >
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="round" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} width={28} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="sustainability" stroke="var(--governance-green)" strokeWidth={1.5} dot={false} name="Sustainability" />
            <Line type="monotone" dataKey="biodiversity" stroke="var(--eco-bio)" strokeWidth={1} dot={false} name="Biodiversity" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

/** Inline sparkline for use in summaries */
export function Sparkline({
  data,
  color = 'var(--commons-teal)',
  width = 80,
  height = 24,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Helpers ──

function ChartCard({
  icon,
  label,
  color,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-center gap-1.5 mb-2" style={{ color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  eurFields,
  pctFields,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  eurFields?: string[];
  pctFields?: string[];
}) {
  if (!active || !payload) return null;

  return (
    <div className="glass rounded-lg px-3 py-2 text-[10px]">
      <div className="text-[var(--text-secondary)] mb-1">Year {label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[var(--text-secondary)]">{p.name}:</span>
          <span className="font-mono text-[var(--text-primary)]">
            {eurFields?.includes(p.name.toLowerCase())
              ? `€${compactEUR(p.value)}`
              : pctFields?.includes(p.name.toLowerCase())
                ? `${p.value.toFixed(0)}%`
                : compactNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function compactNum(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function compactEUR(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

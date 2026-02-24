import { Scroll } from '@phosphor-icons/react';
import type { RoundResult, AgentState, GovernanceConfig, AgentAction, GovernanceEvent } from '../types';

interface Props {
  currentRound: RoundResult;
  previousRound: RoundResult | null;
  agents: AgentState[];
  governance: GovernanceConfig;
}

export function RoundNarrative({ currentRound, previousRound, agents, governance }: Props) {
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const resolveName = (id: string) => agentMap.get(id) ?? id.slice(0, 8);

  const sentences: string[] = [];

  sentences.push(`Round ${currentRound.round}:`);

  const actionsByAgent = groupBy(currentRound.actions, (a) => a.agentId);
  for (const [agentId, actions] of actionsByAgent) {
    const name = resolveName(agentId);
    const summaries = actions.map((a) => describeAction(a, governance));
    sentences.push(`${name} ${summaries.join('; ')}.`);
  }

  const eventSummaries = summarizeGovernanceEvents(currentRound.governanceEvents, resolveName);
  sentences.push(...eventSummaries);

  if (previousRound) {
    const delta = currentRound.commonsLevel - previousRound.commonsLevel;
    const pct = previousRound.commonsLevel > 0
      ? ((delta / previousRound.commonsLevel) * 100).toFixed(0)
      : '0';
    if (delta > 0) {
      sentences.push(`Commons grew ${Number(pct) > 0 ? '+' : ''}${pct}% to ${currentRound.commonsLevel.toFixed(0)}.`);
    } else if (delta < 0) {
      sentences.push(`Commons dropped ${pct}% to ${currentRound.commonsLevel.toFixed(0)}.`);
    } else {
      sentences.push(`Commons held steady at ${currentRound.commonsLevel.toFixed(0)}.`);
    }

    const prevEco = previousRound.territorySnapshot.totalEcosystemValue;
    const currEco = currentRound.territorySnapshot.totalEcosystemValue;
    if (prevEco != null && currEco != null && prevEco > 0) {
      const ecoDelta = currEco - prevEco;
      const ecoPct = (ecoDelta / prevEco) * 100;
      if (Math.abs(ecoPct) > 3) {
        const direction = ecoDelta > 0 ? 'recovered' : 'declined';
        sentences.push(`Ecosystem services ${direction} ${Math.abs(ecoPct).toFixed(0)}% to ${formatNarrativeEUR(currEco)}/yr.`);
      }
    }
  } else {
    sentences.push(`Commons at ${currentRound.commonsLevel.toFixed(0)}.`);
    const eco = currentRound.territorySnapshot.totalEcosystemValue;
    if (eco != null && eco > 0) {
      sentences.push(`Ecosystem services valued at ${formatNarrativeEUR(eco)}/yr.`);
    }
  }

  if (currentRound.ballotSummary) {
    const b = currentRound.ballotSummary;
    if (b.disclosed && b.results) {
      const outcome = b.results.yes > b.results.no ? 'passed' : 'rejected';
      sentences.push(`Vote on "${b.proposalDescription}" \u2014 ${b.results.yes} yes, ${b.results.no} no \u2014 ${outcome}.`);
    } else {
      sentences.push(`Vote on "${b.proposalDescription}" \u2014 ballots sealed.`);
    }
  }

  const activeFailures = currentRound.failureModes.filter((fm) => fm.status !== 'inactive');
  if (activeFailures.length > 0) {
    const fmNames = activeFailures.map((fm) => {
      const prefix = fm.status === 'critical' ? 'CRITICAL: ' : fm.status === 'triggered' ? 'TRIGGERED: ' : '';
      return `${prefix}${fm.name} (${(fm.severity * 100).toFixed(0)}%)`;
    });
    sentences.push(`Failure modes: ${fmNames.join(', ')}.`);
  }

  return (
    <div className="flex items-center gap-2.5 px-5 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border)] overflow-x-auto">
      <Scroll size={14} weight="duotone" className="text-[var(--commons-teal)] shrink-0" />
      <p className="text-[12px] text-[var(--text-primary)] leading-relaxed whitespace-nowrap">
        {sentences.join(' ')}
      </p>
    </div>
  );
}

function describeAction(action: AgentAction, governance: GovernanceConfig): string {
  switch (action.type) {
    case 'consume':
      return `consumed ${action.amount?.toFixed(0) ?? '?'}`;
    case 'contribute':
      return `contributed ${action.amount?.toFixed(0) ?? '?'}`;
    case 'propose_rule':
      return `proposed "${action.proposal?.description ?? 'a rule change'}"`;
    case 'vote':
      return `voted ${action.vote ?? '?'}`;
    case 'abstain':
      return `abstained${governance.id === 'tragedy' ? '' : ' from voting'}`;
    default:
      return action.type;
  }
}

function summarizeGovernanceEvents(
  events: GovernanceEvent[],
  resolveName: (id: string) => string,
): string[] {
  const summaries: string[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'enforcement_check':
        summaries.push(`Enforcement check ran${event.details.violators ? ` \u2014 ${(event.details.violators as string[]).length} violator(s)` : ''}.`);
        break;
      case 'sanction_applied': {
        const agentName = event.details.agentId ? resolveName(String(event.details.agentId)) : 'an agent';
        const level = event.details.level ?? 'sanction';
        summaries.push(`${String(level).charAt(0).toUpperCase() + String(level).slice(1)} issued to ${agentName}.`);
        break;
      }
      case 'agent_excluded': {
        const name = event.details.agentId ? resolveName(String(event.details.agentId)) : 'An agent';
        summaries.push(`${name} excluded.`);
        break;
      }
      case 'agent_suspended': {
        const name = event.details.agentId ? resolveName(String(event.details.agentId)) : 'An agent';
        summaries.push(`${name} suspended ${event.details.duration ?? '?'}r.`);
        break;
      }
      case 'proposal_created':
        summaries.push(`New proposal: "${event.details.description ?? ''}".`);
        break;
      case 'vote_tallied':
        summaries.push(`Vote tallied: ${event.details.result ?? 'unknown'}.`);
        break;
      case 'stake_slashed': {
        const name = event.details.agentId ? resolveName(String(event.details.agentId)) : 'An agent';
        summaries.push(`${name}'s stake slashed by ${event.details.amount ?? '?'}.`);
        break;
      }
      default:
        break;
    }
  }
  return summaries;
}

function formatNarrativeEUR(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return map;
}

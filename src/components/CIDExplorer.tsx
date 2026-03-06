import { useState } from 'react';
import type { RoundResult } from '../types';
import { getGatewayUrl, isLocalPseudoCID } from '../engine/storage/storacha';
import {
  X,
  HardDrives,
  Copy,
  ArrowSquareOut,
  CheckCircle,
  Lock,
  Globe,
  Database,
} from '@phosphor-icons/react';

interface Props {
  open: boolean;
  onClose: () => void;
  history: RoundResult[];
}

export function CIDExplorer({ open, onClose, history }: Props) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!open) return null;

  // Filter rounds with CIDs and reverse for newest-first
  const roundsWithCIDs = history.filter(r => r.cid).reverse();

  // Stats
  const realCIDCount = roundsWithCIDs.filter(r => !isLocalPseudoCID(r.cid!)).length;
  const localCIDCount = roundsWithCIDs.filter(r => isLocalPseudoCID(r.cid!)).length;
  const totalSize = roundsWithCIDs.length * 10; // Rough estimate: ~10KB per round

  const handleCopy = (cid: string, idx: number) => {
    navigator.clipboard.writeText(cid).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  const handleRowClick = (cid: string, idx: number) => {
    const gwUrl = getGatewayUrl(cid);
    if (gwUrl) {
      window.open(gwUrl, '_blank', 'noopener');
    } else {
      handleCopy(cid, idx);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-hidden bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] shadow-2xl m-4 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <HardDrives size={20} weight="duotone" className="text-[var(--commons-teal)]" />
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Storacha Audit Trail
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] mt-0.5">
                <span>{roundsWithCIDs.length} CIDs</span>
                <span className="opacity-40">|</span>
                <span>~{totalSize} KB</span>
                <span className="opacity-40">|</span>
                <span className="text-[var(--governance-green)]">{realCIDCount} real</span>
                {localCIDCount > 0 && (
                  <>
                    <span className="opacity-40">,</span>
                    <span className="text-[var(--text-secondary)]">{localCIDCount} local</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {roundsWithCIDs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-[var(--text-secondary)]">
              <Database size={32} weight="duotone" className="opacity-30" />
              <p className="text-sm">No CIDs recorded yet</p>
              <p className="text-xs opacity-60">Run simulation rounds to generate state CIDs</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-surface)]">
                <tr className="border-b border-[var(--border)] text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                  <th className="px-5 py-2 text-left font-medium">Round</th>
                  <th className="px-3 py-2 text-left font-medium">CID</th>
                  <th className="px-5 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {roundsWithCIDs.map((round, idx) => {
                  const cid = round.cid!;
                  const isLocal = isLocalPseudoCID(cid);
                  const hasLitSeal = round.ballotSummary?.litSeal;
                  const isCopied = copiedIdx === idx;

                  return (
                    <tr
                      key={round.round}
                      onClick={() => handleRowClick(cid, idx)}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono font-semibold text-[var(--text-primary)]">
                          {round.round}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[var(--commons-teal)] truncate max-w-[200px]">
                            {cid}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(cid, idx);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-base)] transition-all"
                            title="Copy CID"
                          >
                            {isCopied ? (
                              <CheckCircle size={12} className="text-[var(--governance-green)]" />
                            ) : (
                              <Copy size={12} className="text-[var(--text-secondary)]" />
                            )}
                          </button>
                          {hasLitSeal && (
                            <span title="Has Lit Protocol seal">
                              <Lock
                                size={10}
                                weight="fill"
                                className="text-[var(--sacred-purple)]"
                              />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isLocal ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                            <Database size={10} />
                            Local
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--governance-green)]/15 text-[var(--governance-green)]">
                            <Globe size={10} />
                            Gateway
                            <ArrowSquareOut size={9} className="opacity-60" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-base)]">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <span>
              Click row to {realCIDCount > 0 ? 'open gateway' : 'copy CID'}
            </span>
            <span className="flex items-center gap-1">
              <Lock size={10} className="text-[var(--sacred-purple)]" />
              = has Lit seal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

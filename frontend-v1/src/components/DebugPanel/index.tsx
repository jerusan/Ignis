import { useState, type ComponentType, type ReactNode } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CpuIcon,
  CoinsIcon,
  WrenchIcon,
  ActivityIcon } from
'lucide-react';
import type { DebugTurn } from '../../types/chat';

export type { DebugTurn };
export interface DebugPanelProps {
  turns: DebugTurn[];
  defaultOpen?: boolean;
}
function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
function Stat({
  icon: Icon,
  label,
  value






}: {icon: ComponentType<{className?: string;}>;label: string;value: ReactNode;}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-3.5 h-3.5 text-foreground-subtle flex-shrink-0" />
      <span className="text-[10px] uppercase tracking-wide text-foreground-subtle">
        {label}
      </span>
      <span className="font-mono text-xs text-foreground truncate">
        {value}
      </span>
    </div>);

}
function DebugPanel({ turns, defaultOpen = false }: DebugPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const totals = turns.reduce(
    (acc, t) => ({
      latency: acc.latency + t.latencyMs,
      input: acc.input + t.inputTokens,
      output: acc.output + t.outputTokens,
      cost: acc.cost + t.costUsd,
      tools: acc.tools + t.toolsCalled.length
    }),
    {
      latency: 0,
      input: 0,
      output: 0,
      cost: 0,
      tools: 0
    }
  );
  return (
    <div className="border border-background-subtle rounded-lg bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-background-muted transition-colors">
        
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-4 h-4 text-primary" />
          <span className="font-heading font-medium text-sm text-foreground">
            Debug
          </span>
          <span className="text-xs text-foreground-subtle">
            {turns.length} turn{turns.length === 1 ? '' : 's'} ·{' '}
            {formatCost(totals.cost)} · {formatLatency(totals.latency)}
          </span>
        </div>
        {open ?
        <ChevronUpIcon className="w-4 h-4 text-foreground-muted" /> :

        <ChevronDownIcon className="w-4 h-4 text-foreground-muted" />
        }
      </button>

      {open &&
      <div className="border-t border-background-subtle divide-y divide-background-subtle">
          {turns.length === 0 ?
        <div className="px-3 py-4 text-xs text-foreground-subtle text-center">
              No turns recorded yet.
            </div> :

        turns.map((t, i) =>
        <div key={t.id} className="px-3 py-2.5 space-y-2 bg-background">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-foreground-muted">
                    #{i + 1} {t.label ?? ''}
                  </span>
                  <span className="font-mono text-[11px] text-foreground-subtle">
                    {t.id}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5">
                  <Stat
              icon={ClockIcon}
              label="Latency"
              value={formatLatency(t.latencyMs)} />
            
                  <Stat
              icon={CpuIcon}
              label="Tokens"
              value={`${t.inputTokens.toLocaleString()} → ${t.outputTokens.toLocaleString()}`} />
            
                  <Stat
              icon={CoinsIcon}
              label="Cost"
              value={formatCost(t.costUsd)} />
            
                  <Stat
              icon={WrenchIcon}
              label="Tools"
              value={
              t.toolsCalled.length === 0 ? '—' : t.toolsCalled.length
              } />
            
                </div>
                {t.toolsCalled.length > 0 &&
          <div className="flex flex-wrap gap-1 pt-1">
                    {t.toolsCalled.map((tool, idx) =>
            <code
              key={`${tool}-${idx}`}
              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-background-muted text-foreground-muted">
              
                        {tool}
                      </code>
            )}
                  </div>
          }
              </div>
        )
        }
        </div>
      }
    </div>);

}
export default DebugPanel;

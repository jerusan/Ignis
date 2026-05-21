// frontend/src/components/RightZone.tsx
//
// Permanent right HUD: session state + telemetry turn log.
//
import React from 'react';
import { useWorkbench } from './WorkbenchOverlay';
import type { DebugTurn } from './DebugPanel';

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-0.5">
            <span className="text-[10px] font-mono text-zinc-600">{label}</span>
            <span className="text-[10px] font-mono text-zinc-300">{value}</span>
        </div>
    );
}

function TurnRow({ turn }: { turn: DebugTurn }) {
    return (
        <div className="px-3 py-2 border-b border-zinc-800/40">
            <p className="text-[10px] text-zinc-400 truncate mb-1">{turn.label ?? turn.id}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="text-[9px] font-mono text-zinc-600">{turn.latencyMs}ms</span>
                <span className="text-[9px] font-mono text-zinc-600">
                    {(turn.inputTokens + turn.outputTokens).toLocaleString()} tok
                </span>
                <span className="text-[9px] font-mono text-zinc-600">${turn.costUsd.toFixed(4)}</span>
            </div>
            {turn.toolsCalled.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {turn.toolsCalled.map(t => (
                        <span
                            key={t}
                            className="text-[8px] font-mono bg-zinc-800 text-zinc-500 px-1 py-0.5 rounded"
                        >
                            {t}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export function RightZone() {
    const { sessionState, turns } = useWorkbench();
    const totalTokens = turns.reduce((s, t) => s + t.inputTokens + t.outputTokens, 0);
    const totalCost   = turns.reduce((s, t) => s + t.costUsd, 0);

    return (
        <aside className="bg-zinc-950 border-l border-zinc-800/80 flex flex-col h-full overflow-hidden">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-4 py-2.5 border-b border-zinc-800/80">
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    HUD
                </span>
            </div>

            {/* ── Active setup ─────────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/60">
                <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-600 block mb-2">
                    Active Setup
                </span>
                <Stat
                    label="Process"
                    value={sessionState.process ?? <span className="text-zinc-700">—</span>}
                />
                <Stat
                    label="Voltage"
                    value={sessionState.voltage ?? <span className="text-zinc-700">—</span>}
                />
                <Stat
                    label="Material"
                    value={sessionState.material ?? <span className="text-zinc-700">—</span>}
                />
                <Stat
                    label="Thickness"
                    value={sessionState.thickness ?? <span className="text-zinc-700">—</span>}
                />
                <Stat
                    label="Wire"
                    value={sessionState.wire_size ?? <span className="text-zinc-700">—</span>}
                />
            </div>

            {/* ── Session totals ───────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/60">
                <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-600 block mb-2">
                    Session
                </span>
                <Stat label="Turns"  value={turns.length} />
                <Stat label="Tokens" value={totalTokens.toLocaleString()} />
                <Stat label="Cost"   value={`$${totalCost.toFixed(4)}`} />
            </div>

            {/* ── Turn log (newest first) ──────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {turns.length === 0 ? (
                    <div className="px-4 py-4 text-center">
                        <p className="text-[10px] font-mono text-zinc-700">No turns yet</p>
                    </div>
                ) : (
                    [...turns].reverse().map(t => <TurnRow key={t.id} turn={t} />)
                )}
            </div>
        </aside>
    );
}

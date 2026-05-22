import React, { useEffect, useRef, useState } from 'react';
import { useWorkbench } from '../WorkbenchOverlay';
import CableDiagram from './CableDiagram';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PolarityEntry {
    process: string;
    mode: 'DCEP' | 'DCEN';
    description: string;
    ground_socket: string;
    wire_socket?: string;
    torch_socket?: string;
    electrode_socket?: string;
    gas_required: boolean;
    gas_type?: string;
    note?: string;
}

interface GasSetting {
    flow_scfh_min: number;
    flow_scfh_max: number;
    type: string;
}

interface SpecsData {
    polarity: PolarityEntry[];
    gas_settings: Record<string, GasSetting>;
}

// ── Process pills ─────────────────────────────────────────────────────────────

const PROCESS_PILLS = [
    { label: 'MIG',        key: 'MIG' },
    { label: 'Flux-Cored', key: 'flux_cored' },
    { label: 'TIG',        key: 'TIG' },
    { label: 'Stick',      key: 'Stick' },
] as const;

type ProcessKey = typeof PROCESS_PILLS[number]['key'];

// Electrode-side socket field varies by process
const ELECTRODE_SOCKET_FIELD: Record<ProcessKey, keyof PolarityEntry> = {
    MIG:        'wire_socket',
    flux_cored: 'wire_socket',
    TIG:        'torch_socket',
    Stick:      'electrode_socket',
};

const ELECTRODE_LABEL: Record<ProcessKey, string> = {
    MIG:        'Wire Gun',
    flux_cored: 'Wire Gun',
    TIG:        'Torch',
    Stick:      'Electrode Holder',
};

function MetricCard({ label, value, accentVar }: { label: string; value: React.ReactNode; accentVar?: string }) {
    return (
        <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-ignis-border-subtle bg-ignis-bg-surface shadow-inner relative overflow-hidden group">
            {accentVar && (
                <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300" 
                    style={{ backgroundColor: `var(${accentVar})` }} 
                />
            )}
            <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-ignis-text-muted">
                {label}
            </span>
            <span 
                className="text-sm font-mono tracking-tight" 
                style={{ color: accentVar ? `var(${accentVar})` : 'var(--ignis-text-primary)' }}
            >
                {value}
            </span>
        </div>
    );
}

export function PolarityConfigurator() {
    const { sessionState, setSessionState } = useWorkbench();
    const [specs, setSpecs] = useState<SpecsData | null>(null);
    const [selectedProcess, setSelectedProcess] = useState<ProcessKey>('MIG');

    // Fetch specs
    useEffect(() => {
        fetch('/specs')
            .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<SpecsData>; })
            .then(setSpecs)
            .catch(() => {});
    }, []);

    // Pre-select process from sessionState on mount
    const initDone = useRef(false);
    useEffect(() => {
        if (initDone.current) return;
        initDone.current = true;
        if (sessionState.process) {
            const match = PROCESS_PILLS.find(
                p => p.label === sessionState.process || p.key === sessionState.process,
            );
            if (match) setSelectedProcess(match.key);
        }
    }, [sessionState.process]);

    // Write process label back to sessionState
    useEffect(() => {
        const pill = PROCESS_PILLS.find(p => p.key === selectedProcess);
        if (!pill || sessionState.process === pill.label) return;
        setSessionState({ ...sessionState, process: pill.label });
    }, [selectedProcess, sessionState, setSessionState]);

    const polarityEntry = specs?.polarity.find(p => p.process === selectedProcess) ?? null;
    const gasEntry = specs?.gas_settings[selectedProcess] ?? null;
    const mode = polarityEntry?.mode ?? 'DCEP';

    const electrodeSocket = polarityEntry
        ? (polarityEntry[ELECTRODE_SOCKET_FIELD[selectedProcess]] as string | undefined) ?? '—'
        : '—';

    // Map intent colors based on theme tokens
    const electrodeAccent = mode === 'DCEP' ? '--ignis-accent-dcep' : '--ignis-accent-dcen';
    const clampAccent = mode === 'DCEP' ? '--ignis-accent-dcen' : '--ignis-accent-dcep';
    const activeGlow = mode === 'DCEP' ? 'var(--ignis-glow-dcep)' : 'var(--ignis-glow-dcen)';

    return (
        <div className="flex flex-col h-full bg-ignis-bg-base">
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-12 border-b border-ignis-border-strong bg-ignis-bg-panel shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: `var(${electrodeAccent})`, boxShadow: activeGlow }} />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-ignis-text-muted">
                        Process Polarity & Gas
                    </span>
                </div>

                <div className="flex items-center gap-1.5 p-1 rounded-md bg-ignis-bg-surface border border-ignis-border-subtle">
                    {PROCESS_PILLS.map(pill => {
                        const isActive = selectedProcess === pill.key;
                        return (
                            <button
                                key={pill.key}
                                onClick={() => setSelectedProcess(pill.key)}
                                className={`px-3 py-1 rounded-[4px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-200 ${
                                    isActive 
                                    ? 'bg-ignis-accent-primary/10 text-ignis-accent-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] border border-ignis-border-focus' 
                                    : 'text-ignis-text-muted hover:text-ignis-text-secondary border border-transparent'
                                }`}
                            >
                                {pill.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Split Body */}
            <div className="flex-1 flex min-h-0">
                {/* SVG Canvas */}
                <div className="flex-1 flex items-center justify-center p-8 relative">
                    <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(circle_at_center,_var(--ignis-text-primary)_1px,_transparent_1px)] bg-[length:24px_24px]" />
                    <div className="w-full max-w-md aspect-video relative z-10 transition-transform duration-500 ease-out hover:scale-[1.02]">
                        <CableDiagram mode={mode} processKey={selectedProcess} />
                    </div>
                </div>

                {/* Hardware Telemetry Sidebar */}
                <div className="w-[320px] shrink-0 border-l border-ignis-border-strong bg-ignis-bg-panel p-6 overflow-y-auto">
                    
                    {/* Active Mode Display */}
                    <div className="flex flex-col mb-8">
                        <div 
                            className="inline-flex self-start items-center px-4 py-1.5 rounded-md border backdrop-blur-md mb-3 transition-colors duration-300"
                            style={{ 
                                backgroundColor: `color-mix(in srgb, var(${electrodeAccent}) 15%, transparent)`,
                                borderColor: `color-mix(in srgb, var(${electrodeAccent}) 30%, transparent)`
                            }}
                        >
                            <span 
                                className="text-lg font-mono font-bold tracking-widest"
                                style={{ color: `var(${electrodeAccent})`, textShadow: activeGlow }}
                            >
                                {mode}
                            </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-ignis-text-secondary">
                            {polarityEntry?.description ?? '—'}
                        </p>
                    </div>

                    {/* Small Multiples: Wiring */}
                    <div className="mb-6">
                        <h3 className="text-[9px] font-mono uppercase tracking-[0.25em] text-ignis-text-disabled mb-3">
                            Wiring Configuration
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <MetricCard 
                                label={ELECTRODE_LABEL[selectedProcess]} 
                                value={electrodeSocket} 
                                accentVar={electrodeAccent} 
                            />
                            <MetricCard 
                                label="Work Clamp" 
                                value={polarityEntry?.ground_socket ?? '—'} 
                                accentVar={clampAccent} 
                            />
                            {selectedProcess === 'TIG' && (
                                <MetricCard 
                                    label="Foot Pedal" 
                                    value={(polarityEntry as any).foot_pedal_socket ?? '—'} 
                                />
                            )}
                        </div>
                    </div>

                    {/* Small Multiples: Gas */}
                    {polarityEntry?.gas_required && gasEntry && (
                        <div className="mb-6 animate-fade-in">
                            <h3 className="text-[9px] font-mono uppercase tracking-[0.25em] text-ignis-text-disabled mb-3">
                                Shielding Gas
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                <MetricCard label="Gas Type" value={gasEntry.type} />
                                <MetricCard 
                                    label="Flow Rate" 
                                    value={`${gasEntry.flow_scfh_min}–${gasEntry.flow_scfh_max} CFH`} 
                                    accentVar="--ignis-accent-success" 
                                />
                            </div>
                        </div>
                    )}

                    {/* Safety Warnings */}
                    {selectedProcess === 'flux_cored' && (
                        <div className="p-3.5 rounded-lg border border-ignis-accent-warning/30 bg-ignis-accent-warning/10 animate-fade-in">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-mono font-bold text-ignis-accent-warning">
                                    ⚠ NO SHIELDING GAS
                                </span>
                            </div>
                            <p className="text-[10px] leading-relaxed text-ignis-text-secondary">
                                Do NOT connect gas. Self-shielded wire generates its own protection from the flux core.
                            </p>
                        </div>
                    )}

                    {/* Stick Information */}
                    {selectedProcess === 'Stick' && polarityEntry?.note && (
                        <div className="p-3.5 rounded-lg border border-ignis-border-strong bg-white/[0.03] animate-fade-in mt-6">
                            <p className="text-[10px] font-mono font-bold text-ignis-text-muted mb-1.5">
                                ℹ POLARITY NOTE
                            </p>
                            <p className="text-[10px] leading-relaxed text-ignis-text-secondary">
                                {polarityEntry.note}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PolarityConfigurator;

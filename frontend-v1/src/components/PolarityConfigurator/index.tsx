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

// ── Constraint row ────────────────────────────────────────────────────────────

function Row({
    label,
    value,
    accent,
}: {
    label: string;
    value: React.ReactNode;
    accent?: string;
}) {
    return (
        <div
            className="flex items-start justify-between gap-3 py-2.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
            <span
                className="text-[10px] font-mono uppercase tracking-[0.12em] flex-shrink-0"
                style={{ color: '#4b5563' }}
            >
                {label}
            </span>
            <span
                className="text-[10px] font-mono text-right leading-relaxed"
                style={{ color: accent ?? '#d4d8e4' }}
            >
                {value}
            </span>
        </div>
    );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p
            className="text-[8px] font-mono uppercase tracking-[0.22em] mb-2 mt-5 first:mt-0"
            style={{ color: '#3d4760' }}
        >
            {children}
        </p>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PolarityConfigurator() {
    const { sessionState, setSessionState } = useWorkbench();

    const [specs,           setSpecs]           = useState<SpecsData | null>(null);
    const [selectedProcess, setSelectedProcess] = useState<ProcessKey>('MIG');

    // Fetch specs (same endpoint as Phase 2 & 3)
    useEffect(() => {
        fetch('/specs')
            .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<SpecsData>; })
            .then(setSpecs)
            .catch(() => {});
    }, []);

    // Pre-select process from sessionState on mount (once — guard against loops)
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

    // Write process label back to sessionState when local selection changes.
    // Uses spread rather than functional update to match the context's (s: SessionState) => void type.
    useEffect(() => {
        const pill = PROCESS_PILLS.find(p => p.key === selectedProcess);
        if (!pill || sessionState.process === pill.label) return;
        setSessionState({ ...sessionState, process: pill.label });
    }, [selectedProcess, sessionState, setSessionState]);

    // Derived data
    const polarityEntry = specs?.polarity.find(p => p.process === selectedProcess) ?? null;
    const gasEntry      = specs?.gas_settings[selectedProcess] ?? null;
    const mode          = polarityEntry?.mode ?? 'DCEP';

    const electrodeSocket = polarityEntry
        ? (polarityEntry[ELECTRODE_SOCKET_FIELD[selectedProcess]] as string | undefined) ?? '—'
        : '—';

    const electrodeAccent = mode === 'DCEP' ? '#ff6b00' : '#38bdf8';
    const clampAccent     = mode === 'DCEP' ? '#38bdf8' : '#ff6b00';

    return (
        <div className="flex flex-col h-full" style={{ backgroundColor: '#141418' }}>

            {/* ── Header ─────────────────────────────────────────────── */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-5 gap-4"
                style={{
                    height: 44,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    backgroundColor: '#0f1012',
                    flexShrink: 0,
                }}
            >
                <span
                    className="text-[9px] font-mono uppercase tracking-[0.2em] flex-shrink-0"
                    style={{ color: '#3d4760' }}
                >
                    Process Polarity &amp; Gas
                </span>

                {/* Process selector pills */}
                <div className="flex items-center gap-1">
                    {PROCESS_PILLS.map(pill => {
                        const isActive = selectedProcess === pill.key;
                        return (
                            <button
                                key={pill.key}
                                onClick={() => setSelectedProcess(pill.key)}
                                className="px-2.5 py-1 rounded text-[9px] font-mono font-semibold uppercase tracking-[0.1em] transition-all duration-150 flex-shrink-0"
                                style={isActive ? {
                                    backgroundColor: 'rgba(255,107,0,0.14)',
                                    border:          '1px solid rgba(255,107,0,0.38)',
                                    color:           '#ff6b00',
                                } : {
                                    backgroundColor: 'transparent',
                                    border:          '1px solid rgba(255,255,255,0.07)',
                                    color:           '#5c6478',
                                }}
                            >
                                {pill.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Body: diagram + constraints ────────────────────────── */}
            <div className="flex-1 min-h-0 flex overflow-hidden">

                {/* Left — animated SVG cable diagram */}
                <div
                    className="flex-1 min-w-0 flex items-center justify-center p-6"
                    style={{ backgroundColor: '#141418' }}
                >
                    <div style={{ width: '100%', maxWidth: 380, aspectRatio: '360 / 240' }}>
                        <CableDiagram mode={mode} processKey={selectedProcess} />
                    </div>
                </div>

                {/* Divider */}
                <div
                    className="flex-shrink-0"
                    style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }}
                />

                {/* Right — constraints card */}
                <div
                    className="flex-shrink-0 overflow-y-auto"
                    style={{
                        width: 260,
                        backgroundColor: '#111215',
                        padding: '20px 20px 28px',
                    }}
                >
                    {/* Mode badge */}
                    <div className="mb-5">
                        <div
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
                            style={{
                                backgroundColor: 'rgba(255,107,0,0.1)',
                                border:          '1px solid rgba(255,107,0,0.25)',
                            }}
                        >
                            <span
                                className="text-[17px] font-mono font-bold tracking-wider"
                                style={{ color: '#ff6b00' }}
                            >
                                {mode}
                            </span>
                        </div>
                        <p className="text-[10px] leading-relaxed" style={{ color: '#5c6478' }}>
                            {polarityEntry?.description ?? '—'}
                        </p>
                    </div>

                    {/* Wiring */}
                    <SectionLabel>Wiring</SectionLabel>
                    <Row
                        label={ELECTRODE_LABEL[selectedProcess]}
                        value={electrodeSocket}
                        accent={electrodeAccent}
                    />
                    <Row
                        label="Work Clamp"
                        value={polarityEntry?.ground_socket ?? '—'}
                        accent={clampAccent}
                    />
                    {/* TIG foot pedal */}
                    {selectedProcess === 'TIG' && polarityEntry && 'foot_pedal_socket' in polarityEntry && (
                        <Row
                            label="Foot Pedal"
                            value={(polarityEntry as PolarityEntry & { foot_pedal_socket?: string }).foot_pedal_socket ?? '—'}
                        />
                    )}

                    {/* Gas setup — only when gas is required and flow data exists */}
                    {polarityEntry?.gas_required && gasEntry && (
                        <>
                            <SectionLabel>Gas Setup</SectionLabel>
                            <Row label="Type"      value={gasEntry.type} />
                            <Row
                                label="Flow Rate"
                                value={`${gasEntry.flow_scfh_min}–${gasEntry.flow_scfh_max} SCFH`}
                                accent="#a3e635"
                            />
                        </>
                    )}

                    {/* Flux-cored: danger banner — self-shielded, no gas */}
                    {selectedProcess === 'flux_cored' && (
                        <div
                            className="rounded-lg px-3 py-2.5 mt-5"
                            style={{
                                backgroundColor: 'rgba(251,191,36,0.07)',
                                border:          '1px solid rgba(251,191,36,0.28)',
                            }}
                        >
                            <p
                                className="text-[9px] font-mono font-bold mb-1"
                                style={{ color: '#fbbf24' }}
                            >
                                ⚠ Self-shielded wire
                            </p>
                            <p className="text-[9px] leading-relaxed" style={{ color: '#9ca3af' }}>
                                Do NOT connect shielding gas. Self-shielded flux-cored wire
                                generates its own shield from the flux core.
                            </p>
                        </div>
                    )}

                    {/* Stick: informational note about polarity variance */}
                    {selectedProcess === 'Stick' && polarityEntry?.note && (
                        <div
                            className="rounded-lg px-3 py-2.5 mt-5"
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                border:          '1px solid rgba(255,255,255,0.08)',
                            }}
                        >
                            <p
                                className="text-[9px] font-mono font-bold mb-1"
                                style={{ color: '#9ca3af' }}
                            >
                                ℹ Polarity note
                            </p>
                            <p className="text-[9px] leading-relaxed" style={{ color: '#6b7280' }}>
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

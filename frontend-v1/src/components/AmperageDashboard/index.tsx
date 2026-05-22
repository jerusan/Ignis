import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkbench } from '../WorkbenchOverlay';
import type { FaultCode } from '../../data/faultCodes';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DutyCycleEntry {
    process: string;
    voltage: string;
    range_min: number;
    range_max: number;
    [key: string]: number | string;
}

interface InputPower {
    input_current_rated: string;
    breaker_minimum: string;
    plug_type: string;
}

interface SpecsData {
    duty_cycles: DutyCycleEntry[];
    input_power: Record<string, InputPower>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROCESS_PILLS = [
    { label: 'MIG',        specKey: 'MIG' },
    { label: 'Flux-Cored', specKey: 'flux_cored' },
    { label: 'TIG',        specKey: 'TIG' },
    { label: 'Stick',      specKey: 'Stick' },
] as const;

type SpecProcess = typeof PROCESS_PILLS[number]['specKey'];

const FAULT_CODES: FaultCode[] = [
    {
        code: 'E01',
        name: 'Input Power Fault',
        cause: 'Input voltage too low, unstable, or outside rated range. Often caused by an undersized extension cord or shared circuit.',
        action: 'Verify input voltage is within range (120 V: 104–132 V; 240 V: 208–264 V). Use a dedicated circuit. Limit extension cords to 25 ft, 12 AWG or heavier.',
    },
    {
        code: 'E02',
        name: 'Output Over-Voltage',
        cause: 'Output voltage exceeded the safe limit. Can occur from open-circuit arc conditions, a worn contact tip, or an internal board fault.',
        action: 'Release the trigger and wait 2 minutes. Inspect and replace the contact tip if worn. If the error recurs, contact technical support.',
    },
    {
        code: 'E03',
        name: 'Thermal Overload',
        cause: 'Duty cycle exceeded — internal thermal protection activated to prevent component damage. Blocked vents or high ambient temperature can also trigger this.',
        action: 'Leave power ON so fans continue cooling. Allow 15–20 min cool-down. Check that vents are unobstructed. Review duty cycle limits for the selected amperage.',
    },
    {
        code: 'E04',
        name: 'Wire Feed Motor Fault',
        cause: 'Drive motor stalled or overloaded. Possible causes: wire bird-nesting, excessive drive roll tension, a kinked gun liner, or a jammed contact tip.',
        action: 'Power off. Clear any bird-nest at the drive rolls or gun inlet. Reduce drive roll tension (2–3 flux-cored, 3–5 solid). Straighten or replace a kinked liner.',
    },
    {
        code: 'E05',
        name: 'Communication Error',
        cause: 'Internal communication failure between the control board and inverter board. Can be caused by vibration, a loose cable, or an inverter board fault.',
        action: 'Power cycle the machine (off 30 s, then on). If the error reappears immediately, do not attempt board-level repair — contact Vulcan technical support.',
    },
    {
        code: 'E06',
        name: 'Output Short Circuit',
        cause: 'Output terminals shorted. Wire contacted the workpiece before arc established, trigger held while wire jammed, or the gun cable is internally shorted.',
        action: 'Release the trigger. Clear any wire jam at the contact tip. Set stickout to 1/4–3/8 inch before triggering. Inspect the gun cable for damage.',
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

interface DcTier { pct: number; maxAmp: number; }

function parseTiers(entry: DutyCycleEntry): DcTier[] {
    return Object.entries(entry)
        .filter(([k]) => /^pct_\d+$/.test(k))
        .map(([k, v]) => ({ pct: parseInt(k.slice(4), 10), maxAmp: v as number }))
        .sort((a, b) => b.pct - a.pct); // highest pct first
}

function dcBarColor(pct: number): string {
    if (pct >= 60) return '#22c55e';
    if (pct >= 30) return '#f59e0b';
    return '#f97316';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PillButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wide transition-all duration-150 whitespace-nowrap"
            style={active ? {
                color: '#ff6b00',
                background: 'linear-gradient(180deg, rgba(255,107,0,0.22) 0%, rgba(255,107,0,0.12) 100%)',
                border: '1px solid rgba(255,107,0,0.45)',
                boxShadow: '0 0 8px rgba(255,107,0,0.1)',
            } : {
                color: '#5c6478',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
            }}
        >
            {label}
        </button>
    );
}

function DutyCycleBar({ tier, isExceeded }: { tier: DcTier; isExceeded?: boolean }) {
    const color = isExceeded ? '#ef4444' : dcBarColor(tier.pct);
    const fill  = tier.pct / 100;

    return (
        <div className="space-y-1.5">
            <div className="relative h-4 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                    className="h-full rounded-sm transition-all duration-500"
                    style={{
                        width: `${fill * 100}%`,
                        backgroundColor: color,
                        boxShadow: `0 0 6px ${color}55`,
                    }}
                />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono" style={{ color: '#3d4760' }}>
                    {isExceeded ? 'limit exceeded' : `max ${tier.maxAmp} A`}
                </span>
                <span
                    className="text-[11px] font-mono font-bold tabular-nums"
                    style={{ color: isExceeded ? '#ef4444' : color }}
                >
                    {isExceeded ? 'OVER' : `${tier.pct}%`}
                </span>
            </div>
        </div>
    );
}

function FaultChip({ code, active, onClick }: { code: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wide transition-all duration-150"
            style={active ? {
                color: '#ff6b00',
                background: 'rgba(255,107,0,0.15)',
                border: '1px solid rgba(255,107,0,0.5)',
            } : {
                color: '#5c6478',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
            }}
        >
            {code}
        </button>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AmperageDashboard() {
    const { sessionState, setSessionState } = useWorkbench();

    const [specs,           setSpecs]           = useState<SpecsData | null>(null);
    const [selectedProcess, setSelectedProcess] = useState<SpecProcess>('MIG');
    const [selectedVoltage, setSelectedVoltage] = useState<'120V' | '240V'>('240V');
    const [amperage,        setAmperage]        = useState(130);
    const [activeFault,     setActiveFault]     = useState<string | null>(null);

    // Fetch specs
    useEffect(() => {
        fetch('/specs')
            .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<SpecsData>; })
            .then(setSpecs)
            .catch(() => {});
    }, []);

    // Sync process + voltage from sessionState on mount (once)
    const initDone = useRef(false);
    useEffect(() => {
        if (initDone.current) return;
        initDone.current = true;
        if (sessionState.process) {
            const match = PROCESS_PILLS.find(
                p => p.label === sessionState.process || p.specKey === sessionState.process,
            );
            if (match) setSelectedProcess(match.specKey);
        }
        if (sessionState.voltage) {
            const v = sessionState.voltage.replace(' ', '');
            if (v === '120V' || v === '240V') setSelectedVoltage(v);
        }
    }, [sessionState.process, sessionState.voltage]);

    // Active duty cycle entry
    const activeEntry = useMemo(
        () => specs?.duty_cycles.find(d => d.process === selectedProcess && d.voltage === selectedVoltage) ?? null,
        [specs, selectedProcess, selectedVoltage],
    );

    // Clamp amperage to new entry range when entry changes
    useEffect(() => {
        if (!activeEntry) return;
        setAmperage(prev => {
            const clamped = Math.round(
                Math.max(activeEntry.range_min, Math.min(activeEntry.range_max, prev)) / 5,
            ) * 5;
            return clamped;
        });
    }, [activeEntry]);

    // Duty cycle computation
    const tiers          = useMemo(() => activeEntry ? parseTiers(activeEntry) : [], [activeEntry]);
    const achievable     = useMemo(() => tiers.filter(t => amperage <= t.maxAmp), [amperage, tiers]);
    const displayBars    = achievable.slice(0, 2); // up to 2 bars: sustained + burst
    const isExceeded     = tiers.length > 0 && achievable.length === 0;
    const continuousTier = tiers.find(t => t.pct === 100);
    const showPulse      = !!continuousTier && amperage > continuousTier.maxAmp;

    // Write sessionState when local selections change
    useEffect(() => {
        const pill = PROCESS_PILLS.find(p => p.specKey === selectedProcess);
        if (!pill) return;
        setSessionState(prev => prev.process === pill.label ? prev : { ...prev, process: pill.label });
    }, [selectedProcess, setSessionState]);

    useEffect(() => {
        setSessionState(prev => prev.voltage === selectedVoltage ? prev : { ...prev, voltage: selectedVoltage });
    }, [selectedVoltage, setSessionState]);

    const inputPower = specs?.input_power[selectedVoltage] ?? null;
    const voltageNum = selectedVoltage === '240V' ? 240 : 120;

    const activeFaultData = FAULT_CODES.find(f => f.code === activeFault) ?? null;

    return (
        <div className="flex flex-col h-full" style={{ backgroundColor: '#111215', color: '#d4d8e4' }}>

            {/* ── POWER ENVELOPE ────────────────────────────────────────────── */}
            <div className="flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>

                {/* Section header */}
                <div
                    className="flex items-center justify-between px-5 py-2.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: '#3d4760' }}>
                        Power Envelope
                    </span>
                </div>

                {/* Process + voltage selectors */}
                <div className="px-5 py-3 space-y-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono uppercase tracking-widest w-14 flex-shrink-0" style={{ color: '#2e3852' }}>
                            Process
                        </span>
                        <div className="flex gap-1.5 flex-wrap">
                            {PROCESS_PILLS.map(p => (
                                <PillButton
                                    key={p.specKey}
                                    label={p.label}
                                    active={selectedProcess === p.specKey}
                                    onClick={() => setSelectedProcess(p.specKey)}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono uppercase tracking-widest w-14 flex-shrink-0" style={{ color: '#2e3852' }}>
                            Voltage
                        </span>
                        <div className="flex gap-1.5">
                            {(['120V', '240V'] as const).map(v => (
                                <PillButton
                                    key={v}
                                    label={v}
                                    active={selectedVoltage === v}
                                    onClick={() => setSelectedVoltage(v)}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Amperage slider */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {activeEntry ? (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="range"
                                        min={activeEntry.range_min}
                                        max={activeEntry.range_max}
                                        step={5}
                                        value={amperage}
                                        onChange={e => setAmperage(Number(e.target.value))}
                                        className="w-full"
                                        style={{ accentColor: '#ff6b00' }}
                                    />
                                    {/* Pulse indicator above slider when continuous duty exceeded */}
                                    {showPulse && (
                                        <div className="absolute -top-4 left-0 right-0 flex justify-center pointer-events-none">
                                            <span className="text-[8px] font-mono text-amber-400 animate-pulse">
                                                ⚠ exceeds continuous rating
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-shrink-0 flex items-baseline gap-1 min-w-[56px] justify-end">
                                    <span
                                        className="text-xl font-mono font-bold tabular-nums leading-none"
                                        style={{ color: isExceeded ? '#ef4444' : '#ff6b00' }}
                                    >
                                        {amperage}
                                    </span>
                                    <span className="text-[10px] font-mono" style={{ color: '#5c6478' }}>A</span>
                                </div>
                            </div>
                            <div className="flex justify-between px-0.5">
                                <span className="text-[9px] font-mono tabular-nums" style={{ color: '#2e3852' }}>
                                    {activeEntry.range_min} A
                                </span>
                                <span className="text-[9px] font-mono tabular-nums" style={{ color: '#2e3852' }}>
                                    {activeEntry.range_max} A
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center py-2">
                            <div className="flex gap-1">
                                {[0, 150, 300].map(d => (
                                    <span
                                        key={d}
                                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                                        style={{ backgroundColor: 'rgba(255,107,0,0.5)', animationDelay: `${d}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Duty cycle bars */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-baseline justify-between mb-3">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em]" style={{ color: '#3d4760' }}>
                            Duty Cycle at {amperage} A
                        </span>
                        {isExceeded && (
                            <span className="flex items-center gap-1 text-[9px] font-mono text-red-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />
                                SOA exceeded
                            </span>
                        )}
                    </div>

                    {isExceeded ? (
                        <div className="space-y-3">
                            {tiers.slice(0, 2).map(tier => (
                                <div key={tier.pct} className="space-y-1.5">
                                    <div className="relative h-4 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                        <div className="h-full w-full rounded-sm bg-red-600/60 animate-pulse" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-mono" style={{ color: '#3d4760' }}>
                                            {tier.pct}% limit: {tier.maxAmp} A
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-red-400">OVER</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : displayBars.length > 0 ? (
                        <div className="space-y-3">
                            {displayBars.map((tier, i) => (
                                <div key={tier.pct}>
                                    <DutyCycleBar tier={tier} />
                                    {i === 0 && displayBars.length > 1 && (
                                        <div
                                            className="flex items-center gap-2 mt-2 mb-1"
                                            style={{ color: '#2e3852' }}
                                        >
                                            <span className="text-[8px] font-mono uppercase tracking-widest">
                                                {tier.pct >= 60 ? 'sustained' : 'burst'}
                                            </span>
                                            <div className="flex-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                                            <span className="text-[8px] font-mono uppercase tracking-widest">
                                                {displayBars[1].pct < tier.pct ? 'burst' : 'sustained'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] font-mono" style={{ color: '#2e3852' }}>
                            Select process and voltage to see duty cycle.
                        </p>
                    )}
                </div>

                {/* Input power info */}
                {inputPower && (
                    <div
                        className="px-5 py-3 flex items-center gap-4"
                        style={{ backgroundColor: '#0f1012' }}
                    >
                        <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-mono uppercase tracking-widest" style={{ color: '#2e3852' }}>
                                Input
                            </span>
                            <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: '#9ba5bc' }}>
                                {voltageNum} V&thinsp;/&thinsp;{inputPower.input_current_rated}
                            </span>
                        </div>
                        <div className="w-px h-3 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-mono uppercase tracking-widest" style={{ color: '#2e3852' }}>
                                Breaker
                            </span>
                            <span className="text-[11px] font-mono font-semibold" style={{ color: '#9ba5bc' }}>
                                {inputPower.breaker_minimum}
                            </span>
                        </div>
                        <div className="w-px h-3 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
                        <span className="text-[9px] font-mono" style={{ color: '#2e3852' }}>
                            {inputPower.plug_type}
                        </span>
                    </div>
                )}
            </div>

            {/* ── FAULT CODE DECODER ────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

                {/* Section header */}
                <div
                    className="flex-shrink-0 px-5 py-2.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: '#3d4760' }}>
                        Fault Code Decoder
                    </span>
                </div>

                {/* Fault chips */}
                <div
                    className="flex-shrink-0 flex flex-wrap gap-2 px-5 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                    {FAULT_CODES.map(f => (
                        <FaultChip
                            key={f.code}
                            code={f.code}
                            active={activeFault === f.code}
                            onClick={() => setActiveFault(prev => prev === f.code ? null : f.code)}
                        />
                    ))}
                </div>

                {/* Fault detail card */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {activeFaultData ? (
                        <div className="px-5 py-4 space-y-3">
                            <div>
                                <span
                                    className="text-[10px] font-mono font-bold tracking-wide"
                                    style={{ color: '#ff6b00' }}
                                >
                                    {activeFaultData.code}
                                </span>
                                <span className="text-[10px] font-mono ml-2" style={{ color: '#3d4760' }}>
                                    —
                                </span>
                                <span className="text-sm font-semibold ml-2" style={{ color: '#d4d8e4' }}>
                                    {activeFaultData.name}
                                </span>
                            </div>

                            <div
                                className="rounded-lg px-3.5 py-3 space-y-1"
                                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
                            >
                                <p className="text-[8px] font-mono uppercase tracking-widest mb-1.5" style={{ color: '#2e3852' }}>
                                    Cause
                                </p>
                                <p className="text-xs leading-relaxed" style={{ color: '#8894ad' }}>
                                    {activeFaultData.cause}
                                </p>
                            </div>

                            <div
                                className="rounded-lg px-3.5 py-3"
                                style={{
                                    background: 'rgba(255,107,0,0.04)',
                                    border: '1px solid rgba(255,107,0,0.15)',
                                }}
                            >
                                <p className="text-[8px] font-mono uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,107,0,0.5)' }}>
                                    Action
                                </p>
                                <p className="text-xs leading-relaxed" style={{ color: '#c4895a' }}>
                                    {activeFaultData.action}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full px-5">
                            <p className="text-[10px] font-mono text-center" style={{ color: '#2e3852' }}>
                                Tap a fault code chip to see the cause and corrective action
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AmperageDashboard;

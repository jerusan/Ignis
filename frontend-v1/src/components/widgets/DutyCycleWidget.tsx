import React, { useState, useMemo, useEffect } from 'react';
import { useWorkbench } from '../WorkbenchOverlay';

// Mirrors data/specs.json duty_cycles — static for zero-latency display.
type DcEntry = { process: string; voltage: string; range_min: number; range_max: number; [k: string]: number | string };

const DC_SPECS: DcEntry[] = [
  { process: 'MIG',        voltage: '120V', pct_40: 100, pct_60:  85, pct_100:  75, range_min:  30, range_max: 140 },
  { process: 'MIG',        voltage: '240V', pct_25: 200, pct_60: 130, pct_100: 115, range_min:  30, range_max: 220 },
  { process: 'flux_cored', voltage: '120V', pct_40: 100, pct_60:  85, pct_100:  75, range_min:  30, range_max: 140 },
  { process: 'flux_cored', voltage: '240V', pct_25: 200, pct_60: 130, pct_100: 115, range_min:  30, range_max: 220 },
  { process: 'TIG',        voltage: '120V', pct_40: 125, pct_60: 105, pct_100:  90, range_min:  10, range_max: 125 },
  { process: 'TIG',        voltage: '240V', pct_30: 175, pct_60: 125, pct_100: 105, range_min:  10, range_max: 175 },
  { process: 'Stick',      voltage: '120V', pct_40:  80, pct_60:  70, pct_100:  60, range_min:  10, range_max:  80 },
  { process: 'Stick',      voltage: '240V', pct_25: 175, pct_60: 115, pct_100: 100, range_min:  10, range_max: 175 },
];

const PROCESSES = [
  { key: 'MIG',        label: 'MIG' },
  { key: 'flux_cored', label: 'Flux-Core' },
  { key: 'TIG',        label: 'TIG' },
  { key: 'Stick',      label: 'Stick' },
] as const;
type ProcessKey = typeof PROCESSES[number]['key'];

function parseTiers(e: DcEntry) {
  return Object.entries(e)
    .filter(([k]) => /^pct_\d+$/.test(k))
    .map(([k, v]) => ({ pct: parseInt(k.slice(4), 10), maxAmp: v as number }))
    .sort((a, b) => b.pct - a.pct);
}

function barColor(pct: number) {
  if (pct >= 60) return '#22c55e';
  if (pct >= 30) return '#f59e0b';
  return '#f97316';
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 5, fontSize: 10,
        fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.1s',
        border: active ? '1px solid rgba(255,107,0,0.45)' : '1px solid rgba(255,255,255,0.08)',
        background: active ? 'rgba(255,107,0,0.15)' : 'rgba(255,255,255,0.03)',
        color: active ? '#ff6b00' : '#5c6478',
      }}
    >{label}</button>
  );
}

export function DutyCycleWidget({ params }: { params: Record<string, unknown> }) {
  const { setSessionState } = useWorkbench();

  const initProcess = PROCESSES.some(p => p.key === params.process)
    ? (params.process as ProcessKey) : 'MIG';
  const initVoltage = params.voltage === '120V' ? '120V' : '240V';
  const initAmps = (() => {
    const raw = Number(params.amperage);
    return isFinite(raw) && raw > 0 ? Math.round(raw / 5) * 5 : 130;
  })();

  const [proc, setProc] = useState<ProcessKey>(initProcess);
  const [volt, setVolt] = useState<'120V' | '240V'>(initVoltage);
  const [amps, setAmps] = useState(initAmps);

  const entry = useMemo(() => DC_SPECS.find(d => d.process === proc && d.voltage === volt) ?? null, [proc, volt]);

  useEffect(() => {
    if (!entry) return;
    setAmps(prev => Math.round(Math.max(entry.range_min, Math.min(entry.range_max, prev)) / 5) * 5);
  }, [entry]);

  useEffect(() => {
    const label = PROCESSES.find(p => p.key === proc)?.label ?? proc;
    setSessionState(prev => ({ ...prev, process: label, voltage: volt }));
  }, [proc, volt, setSessionState]);

  const tiers      = useMemo(() => (entry ? parseTiers(entry) : []), [entry]);
  const achievable = useMemo(() => tiers.filter(t => amps <= t.maxAmp), [tiers, amps]);
  const exceeded   = tiers.length > 0 && achievable.length === 0;
  const bars       = achievable.slice(0, 2);
  const continuous = tiers.find(t => t.pct === 100);
  const warnPulse  = !!continuous && amps > continuous.maxAmp;

  return (
    <div style={{ background: '#111215', color: '#d4d8e4', height: '100%', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* Process selector */}
      <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#2e3852', letterSpacing: '0.15em', textTransform: 'uppercase', marginRight: 4, flexShrink: 0 }}>Process</span>
        {PROCESSES.map(p => <Pill key={p.key} label={p.label} active={proc === p.key} onClick={() => setProc(p.key)} />)}
      </div>

      {/* Voltage selector */}
      <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#2e3852', letterSpacing: '0.15em', textTransform: 'uppercase', marginRight: 4 }}>Voltage</span>
        {(['120V', '240V'] as const).map(v => <Pill key={v} label={v} active={volt === v} onClick={() => setVolt(v)} />)}
      </div>

      {/* Slider */}
      {entry && (
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {warnPulse && (
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#f59e0b', marginBottom: 8, textAlign: 'center' }}>
              ⚠ exceeds continuous rating — machine will cycle off to cool
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min={entry.range_min} max={entry.range_max} step={5} value={amps}
              onChange={e => setAmps(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#ff6b00' }} />
            <div style={{ minWidth: 64, textAlign: 'right' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: exceeded ? '#ef4444' : '#ff6b00' }}>{amps}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#5c6478', marginLeft: 3 }}>A</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#2e3852' }}>{entry.range_min} A</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#2e3852' }}>{entry.range_max} A</span>
          </div>
        </div>
      )}

      {/* Duty cycle result */}
      <div style={{ padding: '16px 18px', flex: 1 }}>
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#3d4760', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14 }}>
          Duty Cycle at {amps} A
        </div>

        {exceeded ? (
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
            <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>EXCEEDS SAFE OPERATING AREA</div>
            <div style={{ fontSize: 11, color: '#9ba5bc', lineHeight: 1.5 }}>
              {amps} A exceeds the maximum rating for {PROCESSES.find(p => p.key === proc)?.label} on {volt}.<br />
              Maximum is <strong style={{ color: '#d4d8e4' }}>{tiers[0]?.maxAmp} A</strong> at {tiers[0]?.pct}% duty cycle.
            </div>
          </div>
        ) : bars.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bars.map((t, i) => {
              const color = barColor(t.pct);
              const minOn  = (t.pct / 10).toFixed(0);
              const minOff = ((100 - t.pct) / 10).toFixed(0);
              return (
                <div key={t.pct}>
                  {i > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
                      <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#2e3852', textTransform: 'uppercase', letterSpacing: '0.12em' }}>also achievable</span>
                      <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                  )}
                  <div style={{ height: 16, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: `${t.pct}%`, background: color, borderRadius: 3, boxShadow: `0 0 8px ${color}44`, transition: 'width 0.35s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color }}>{t.pct}%</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#5c6478', marginLeft: 5 }}>duty cycle</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#9ba5bc' }}>
                        {t.pct >= 100 ? 'continuous — no cool-down needed' : `${minOn} min on / ${minOff} min off`}
                      </div>
                      <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#3d4760', marginTop: 3 }}>max {t.maxAmp} A at this duty</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#2e3852' }}>Select a process and voltage above.</div>
        )}
      </div>
    </div>
  );
}

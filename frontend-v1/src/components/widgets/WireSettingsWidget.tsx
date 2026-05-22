import React, { useState } from 'react';

// Mirrors data/specs.json wire_settings + gas_settings
const WIRE_DATA = {
  MIG: {
    sizes: ['0.025"', '0.030"', '0.035"'],
    tensionRange: [3, 5],
    tensionLabel: '3–5 on the idler arm scale',
    gas: 'C25 (75% Argon / 25% CO₂)',
    gasFlow: '20–30 SCFH',
    ctwd: '3/8" – 1/2"',
    stickout: '3/8" – 1/2"',
    note: 'Solid wire — more tension helps prevent slipping',
  },
  flux_cored: {
    sizes: ['0.030"', '0.035"', '0.045"'],
    tensionRange: [2, 3],
    tensionLabel: '2–3 on the idler arm scale',
    gas: null,
    gasFlow: null,
    ctwd: '3/4" – 1"',
    stickout: '3/4" – 1"',
    note: 'Flux-cored wire is softer — less tension prevents crushing the wire',
  },
};

type ProcKey = keyof typeof WIRE_DATA;

const SCALE_MARKS = [1, 2, 3, 4, 5, 6, 7];

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#3d4760', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function TensionScale({ range }: { range: [number, number] }) {
  const [lo, hi] = range;
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {SCALE_MARKS.map(n => {
          const inRange = n >= lo && n <= hi;
          return (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                background: inRange ? 'rgba(255,107,0,0.18)' : 'rgba(255,255,255,0.04)',
                border: inRange ? '1.5px solid rgba(255,107,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: inRange ? '#ff6b00' : '#3d4760',
                boxShadow: inRange ? '0 0 8px rgba(255,107,0,0.15)' : 'none',
                transition: 'all 0.2s',
              }}>
                {n}
              </div>
              {inRange && n === lo && (
                <div style={{ fontSize: 7, fontFamily: 'monospace', color: '#ff6b00', letterSpacing: '0.1em' }}>MIN</div>
              )}
              {inRange && n === hi && (
                <div style={{ fontSize: 7, fontFamily: 'monospace', color: '#ff6b00', letterSpacing: '0.1em' }}>MAX</div>
              )}
            </div>
          );
        })}
        <div style={{ marginLeft: 6, fontSize: 9, fontFamily: 'monospace', color: '#3d4760' }}>
          ← idler arm dial
        </div>
      </div>
    </div>
  );
}

function DistanceVisual({ label, spec }: { label: string; spec: string }) {
  // Parse the spec like "3/8\" – 1/2\"" for visual display
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 7,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* Mini ruler visual */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ width: 2, height: 28, background: 'rgba(255,107,0,0.6)', borderRadius: 1 }} />
        <div style={{ width: 24, height: 2, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
      </div>
      <div>
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#3d4760', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#ff6b00' }}>{spec}</div>
      </div>
    </div>
  );
}

export function WireSettingsWidget({ params }: { params: Record<string, unknown> }) {
  const initProc: ProcKey = params.process === 'flux_cored' ? 'flux_cored' : 'MIG';
  const [proc, setProc] = useState<ProcKey>(initProc);

  const data = WIRE_DATA[proc];

  return (
    <div style={{ background: '#111215', color: '#d4d8e4', height: '100%', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* Process selector */}
      <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#2e3852', letterSpacing: '0.15em', textTransform: 'uppercase', marginRight: 4 }}>Process</span>
        <Pill label="MIG"       active={proc === 'MIG'}        onClick={() => setProc('MIG')} />
        <Pill label="Flux-Core" active={proc === 'flux_cored'} onClick={() => setProc('flux_cored')} />
      </div>

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>

        {/* Wire sizes */}
        <div>
          <SectionLabel>Wire Sizes</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {data.sizes.map(s => (
              <div key={s} style={{
                padding: '7px 14px', borderRadius: 6, fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                color: '#d4d8e4', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              }}>{s}</div>
            ))}
          </div>
        </div>

        {/* Drive roll tension */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
          <SectionLabel>Drive Roll Tension</SectionLabel>
          <TensionScale range={data.tensionRange as [number, number]} />
          <div style={{ marginTop: 8, fontSize: 10, color: '#5c6478' }}>{data.tensionLabel}</div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#3d4760' }}>{data.note}</div>
        </div>

        {/* CTWD + Stickout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
          <SectionLabel>Geometry</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DistanceVisual label="Contact Tip to Work Distance (CTWD)" spec={data.ctwd} />
            <DistanceVisual label="Wire Stickout beyond contact tip" spec={data.stickout} />
          </div>
        </div>

        {/* Gas */}
        {data.gas ? (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <SectionLabel>Shielding Gas</SectionLabel>
            <div style={{
              padding: '10px 14px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
            }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#22c55e', fontWeight: 700 }}>TYPE</div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#22c55e', marginTop: 1 }}>FLOW</div>
              </div>
              <div style={{ width: 1, height: 28, background: 'rgba(34,197,94,0.2)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: '#9ba5bc' }}>{data.gas}</div>
                <div style={{ fontSize: 11, color: '#9ba5bc', marginTop: 3 }}>{data.gasFlow}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 7,
              background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.18)',
              fontSize: 11, color: '#9ba5bc',
            }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#eab308' }}>NO GAS — </span>
              Self-shielded flux-cored does not use external shielding gas. Close the gas valve if installed.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

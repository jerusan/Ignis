import React, { useEffect, useMemo, useState } from 'react';
import {
  entryToSessionState,
  type BaselineEntry,
  type BaselineGridData,
  type GridLabels,
  type MaterialType,
  type WeldProcess,
  type WireSize,
} from '../../data/baselineGrid';
import { useWorkbench } from '../WorkbenchOverlay';

// ── Data fetching ─────────────────────────────────────────────────────────────

function useBaselineGrid() {
  const [data,    setData]    = useState<BaselineGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/baseline-grid')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BaselineGridData>;
      })
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

// ── Primitive sub-components ──────────────────────────────────────────────────

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-xs font-mono font-bold uppercase tracking-wide transition-all duration-150 whitespace-nowrap"
      style={
        active
          ? {
              color: '#ff6b00',
              background:
                'linear-gradient(180deg, rgba(255,107,0,0.22) 0%, rgba(255,107,0,0.12) 100%)',
              border: '1px solid rgba(255,107,0,0.45)',
              boxShadow: '0 0 10px rgba(255,107,0,0.1)',
            }
          : {
              color: '#5c6478',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
            }
      }
    >
      {label}
    </button>
  );
}

function RowLabel({ children, dim }: { children: string; dim?: boolean }) {
  return (
    <span
      className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] w-16 flex-shrink-0 pt-0.5"
      style={{ color: dim ? '#252d3e' : '#3d4760' }}
    >
      {children}
    </span>
  );
}

function SelectorRow({
  label,
  dim,
  children,
}: {
  label: string;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-3 px-5 py-3.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <RowLabel dim={dim}>{label}</RowLabel>
      <div className="flex flex-wrap gap-2 min-w-0">{children}</div>
    </div>
  );
}

// ── Settings card ─────────────────────────────────────────────────────────────

function ctwd(inches: number): string {
  const fractions: Record<number, string> = {
    0.375: '3/8"',
    0.5:   '1/2"',
    0.625: '5/8"',
    0.75:  '3/4"',
  };
  return fractions[inches] ?? `${inches}"`;
}

function StatCell({
  label,
  value,
  accent,
  wide,
}: {
  label: string;
  value: string;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p
        className="text-[8px] font-mono uppercase tracking-widest mb-0.5"
        style={{ color: '#2e3852' }}
      >
        {label}
      </p>
      <p
        className="text-sm font-mono font-bold leading-none"
        style={{ color: accent ? '#ff9d55' : '#d4d8e4' }}
      >
        {value}
      </p>
    </div>
  );
}

function SettingsCard({ entry, labels }: { entry: BaselineEntry; labels: GridLabels }) {
  return (
    <div
      className="flex-shrink-0"
      style={{
        borderTop: '1px solid rgba(255,107,0,0.2)',
        backgroundColor: 'rgba(255,107,0,0.035)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-5 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,107,0,0.12)' }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: '#ff6b00',
              boxShadow: '0 0 6px rgba(255,107,0,0.9)',
            }}
          />
          <span
            className="text-[9px] font-mono font-bold uppercase tracking-[0.2em]"
            style={{ color: '#ff6b00' }}
          >
            Baseline Parameters
          </span>
        </div>
        <span
          className="text-[9px] font-mono truncate max-w-[200px]"
          style={{ color: '#3d4760' }}
        >
          {labels.process[entry.process]} · {labels.material[entry.material]} ·{' '}
          {entry.thickness_label} · {labels.wire[entry.wire]}
        </span>
      </div>

      {/* Stats grid */}
      <div className="px-5 py-3 grid grid-cols-2 gap-x-6 gap-y-3.5">
        <StatCell label="Voltage"   value={`${entry.voltage_v} V`}            accent />
        <StatCell label="Wire Feed" value={`${entry.wfs_ipm} ipm`}            accent />
        <StatCell label="Amperage"  value={`${entry.amp_lo}–${entry.amp_hi} A`} />
        <StatCell label="CTWD"      value={ctwd(entry.ctwd_in)}               />
        {entry.gas      && <StatCell label="Gas"      value={entry.gas}      wide />}
        {entry.polarity && <StatCell label="Polarity" value={entry.polarity}      />}
      </div>

      {entry.note && (
        <div className="px-5 pb-3.5">
          <p
            className="text-[9px] font-mono px-2.5 py-1.5 rounded leading-relaxed"
            style={{
              backgroundColor: 'rgba(255,107,0,0.08)',
              color: '#ff9d55',
              border: '1px solid rgba(255,107,0,0.15)',
            }}
          >
            ⚠ {entry.note}
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyCard() {
  return (
    <div
      className="flex-shrink-0 px-5 py-5 flex items-center justify-center"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        backgroundColor: '#0f1012',
      }}
    >
      <p className="text-[10px] font-mono text-center" style={{ color: '#2e3852' }}>
        Select process → material → thickness → wire&nbsp;to&nbsp;see&nbsp;parameters
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BaselineGrid() {
  const { setSessionState } = useWorkbench();
  const { data, loading, error } = useBaselineGrid();

  const [process,   setProcess]   = useState<WeldProcess | null>(null);
  const [material,  setMaterial]  = useState<MaterialType | null>(null);
  const [thickness, setThickness] = useState<string | null>(null);
  const [wire,      setWire]      = useState<WireSize | null>(null);

  const entries = data?.entries ?? [];
  const labels  = data?.labels;

  // ── Derived option lists ──────────────────────────────────────────────────
  const availableMaterials = useMemo((): MaterialType[] => {
    if (!process) return [];
    const seen = new Set<MaterialType>();
    entries.filter(e => e.process === process).forEach(e => seen.add(e.material));
    return Array.from(seen);
  }, [process, entries]);

  const availableThicknesses = useMemo((): BaselineEntry[] => {
    if (!process || !material) return [];
    const seen = new Set<string>();
    return entries
      .filter(e => e.process === process && e.material === material)
      .filter(e => {
        if (seen.has(e.thickness_label)) return false;
        seen.add(e.thickness_label);
        return true;
      });
  }, [process, material, entries]);

  const availableWires = useMemo((): WireSize[] => {
    if (!process || !material || !thickness) return [];
    const seen = new Set<WireSize>();
    entries
      .filter(e => e.process === process && e.material === material && e.thickness_label === thickness)
      .forEach(e => seen.add(e.wire));
    return Array.from(seen);
  }, [process, material, thickness, entries]);

  // ── Reset cascades ────────────────────────────────────────────────────────
  useEffect(() => { setMaterial(null); setThickness(null); setWire(null); }, [process]);
  useEffect(() => { setThickness(null); setWire(null); }, [material]);
  useEffect(() => {
    setWire(availableWires.length === 1 ? availableWires[0] : null);
  }, [thickness]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Active entry & session-state sync ────────────────────────────────────
  const activeEntry = useMemo((): BaselineEntry | null => {
    if (!process || !material || !thickness || !wire) return null;
    return (
      entries.find(
        e =>
          e.process === process &&
          e.material === material &&
          e.thickness_label === thickness &&
          e.wire === wire,
      ) ?? null
    );
  }, [process, material, thickness, wire, entries]);

  useEffect(() => {
    if (activeEntry && labels) setSessionState(entryToSessionState(activeEntry, labels));
  }, [activeEntry, labels, setSessionState]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: '#111215', color: '#d4d8e4' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-5 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <p
          className="text-[9px] font-mono font-bold uppercase tracking-[0.2em]"
          style={{ color: '#3d4760' }}
        >
          Synergic Parameter Grid · Vulcan OmniPro 220
        </p>
      </div>

      {/* Loading / error states */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
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

      {error && (
        <div className="flex-1 flex items-center justify-center px-5">
          <p className="text-[10px] font-mono text-center" style={{ color: '#b91c1c' }}>
            Failed to load grid data — {error}
          </p>
        </div>
      )}

      {/* Selector rows — scrollable */}
      {!loading && !error && labels && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Process */}
          <SelectorRow label="Process">
            {(Object.keys(labels.process) as WeldProcess[]).map(p => (
              <PillButton
                key={p}
                label={labels.process[p]}
                active={process === p}
                onClick={() => setProcess(p)}
              />
            ))}
          </SelectorRow>

          {/* Material */}
          <SelectorRow label="Material" dim={!process}>
            {process ? (
              availableMaterials.map(m => (
                <PillButton
                  key={m}
                  label={labels.material[m]}
                  active={material === m}
                  onClick={() => setMaterial(m)}
                />
              ))
            ) : (
              <Hint>Select a process first</Hint>
            )}
          </SelectorRow>

          {/* Thickness */}
          <SelectorRow label="Thickness" dim={!material}>
            {material ? (
              availableThicknesses.map(e => (
                <PillButton
                  key={e.thickness_label}
                  label={e.thickness_label}
                  active={thickness === e.thickness_label}
                  onClick={() => setThickness(e.thickness_label)}
                />
              ))
            ) : (
              <Hint>Select a material first</Hint>
            )}
          </SelectorRow>

          {/* Wire */}
          <SelectorRow label="Wire" dim={!thickness}>
            {thickness ? (
              availableWires.map(w => (
                <PillButton
                  key={w}
                  label={labels.wire[w]}
                  active={wire === w}
                  onClick={() => setWire(w)}
                />
              ))
            ) : (
              <Hint>Select a thickness first</Hint>
            )}
          </SelectorRow>
        </div>
      )}

      {/* Settings output — pinned to bottom */}
      {!loading && !error && (
        activeEntry && labels
          ? <SettingsCard entry={activeEntry} labels={labels} />
          : <EmptyCard />
      )}
    </div>
  );
}

function Hint({ children }: { children: string }) {
  return (
    <span className="text-[10px] font-mono" style={{ color: '#2e3852' }}>
      {children}
    </span>
  );
}

export default BaselineGrid;

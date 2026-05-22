/**
 * Types and helpers for the Synergic Baseline Parameter Grid.
 * The actual data lives in /data/baseline_grid.json and is served by the
 * backend at GET /baseline-grid.  Nothing here is hardcoded — keep it that way.
 */
import type { SessionState } from '../lib/chatApi';

// ── Types ──────────────────────────────────────────────────────────────────────
export type WeldProcess  = 'mig' | 'flux_cored';
export type MaterialType = 'mild_steel' | 'stainless' | 'aluminum';
export type WireSize     = '0.023' | '0.025' | '0.030' | '0.035' | '0.045';

export interface BaselineEntry {
  process:         WeldProcess;
  material:        MaterialType;
  thickness_label: string;
  thickness_in:    number;
  wire:            WireSize;
  voltage_v:       number;
  wfs_ipm:         number;
  amp_lo:          number;
  amp_hi:          number;
  ctwd_in:         number;
  gas?:            string;
  polarity?:       string;
  note?:           string;
}

export interface GridLabels {
  process:  Record<WeldProcess,  string>;
  material: Record<MaterialType, string>;
  wire:     Record<WireSize,     string>;
}

export interface BaselineGridData {
  labels:  GridLabels;
  entries: BaselineEntry[];
}

// ── Session-state helper ───────────────────────────────────────────────────────
export function entryToSessionState(
  e: BaselineEntry,
  labels: GridLabels,
): SessionState {
  return {
    process:   labels.process[e.process],
    voltage:   `${e.voltage_v} V`,
    material:  labels.material[e.material],
    thickness: e.thickness_label,
    wire_size: labels.wire[e.wire],
  };
}

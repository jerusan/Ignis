// frontend/src/components/WorkbenchOverlay.tsx
//
// Context provider for the Garage Workbench (delegated to Zustand store).
//
import React, { useEffect, useState, useCallback } from 'react';
import type {
    SessionState,
    ChatArtifact,
    MachineView,
    SpatialControlPoint,
    WelderTelemetry,
} from '../types/chat';
import { REGISTRY_BY_VIEW } from './SpatialViewport';
import { useWorkbenchStore } from '../store/workbenchStore';
import type { WorkbenchState } from '../store/workbenchStore';

// ── Re-export so consumers can import from one place ──────────────────────────
export type { WelderTelemetry };

// ── Registry export formatter (used by GlobalMachineViewer modify mode) ──────────────────
const VIEW_CONST_NAME: Record<MachineView, string> = {
    front:    'WELDER_FRONT_REGISTRY',
    interior: 'WELDER_INTERIOR_REGISTRY',
    back:     'WELDER_REAR_REGISTRY',
};

export function fmtRegistry(view: MachineView, draft: Record<string, SpatialControlPoint>): string {
    const constName = VIEW_CONST_NAME[view];
    const entries = Object.entries(draft).map(([key, pt]) => {
        const desc  = pt.desc.replace(/"/g, '\\"');
        const title = pt.title.replace(/"/g, '\\"');
        return [
            `    "${key}": {`,
            `        x: ${pt.x},`,
            `        y: ${pt.y},`,
            `        radius: ${pt.radius},`,
            `        title: "${title}",`,
            `        desc: "${desc}"`,
            `    }`,
        ].join('\n');
    });
    return `export const ${constName}: Record<string, SpatialControlPoint> = {\n${entries.join(',\n')}\n};`;
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
    const setSessionState = useWorkbenchStore((state) => state.setSessionState);

    // ── ignis:updateWorkbench back-channel ─────────────────────────────────────
    // Artifact iframes can post this message to update session state directly.
    useEffect(() => {
        const ALLOWED_KEYS: (keyof SessionState)[] = ['process', 'voltage', 'material', 'thickness', 'wire_size'];
        const handler = (e: MessageEvent) => {
            if (!e.data || e.data.type !== 'ignis:updateWorkbench') return;
            const payload = e.data.payload;
            if (!payload || typeof payload !== 'object') return;
            setSessionState((prev) => {
                const next = { ...prev };
                for (const key of ALLOWED_KEYS) {
                    if (key in payload) {
                        const val = payload[key];
                        next[key] = typeof val === 'string' ? val : val == null ? null : String(val);
                    }
                }
                return next;
            });
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [setSessionState]);

    return <>{children}</>;
}

export function useWorkbench<T = WorkbenchState>(
    selector?: (state: WorkbenchState) => T
): T {
    if (selector) {
        return useWorkbenchStore(selector);
    }
    return useWorkbenchStore() as unknown as T;
}

// ── Inline mini export panel (used by GlobalMachineViewer modify mode) ───────────────────
export function MiniExportPanel({ code, onDismiss }: { code: string; onDismiss: () => void }) {
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard blocked in some contexts */ }
    }, [code]);

    return (
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/5 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-orange-500/20">
                <span className="text-[9px] font-mono font-bold text-orange-400 uppercase tracking-[0.18em]">
                    Registry Export
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={copy}
                        className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all ${
                            copied
                                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                        }`}
                    >
                        {copied ? '✓ Copied' : 'Copy'}
                    </button>
                    <button
                        onClick={onDismiss}
                        className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-800 hover:border-zinc-700"
                    >
                        ✕
                    </button>
                </div>
            </div>
            <pre className="text-[9px] font-mono text-zinc-300 p-2.5 overflow-x-auto overflow-y-auto max-h-28 bg-zinc-950/60 leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    );
}

// Keep REGISTRY_BY_VIEW re-exported for any existing consumers
export { REGISTRY_BY_VIEW };

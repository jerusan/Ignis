// frontend/src/components/LeftZone.tsx
//
// Permanent left panel: machine view switcher + SpatialViewport + pinned artifacts.
//
import { useState, useEffect, useCallback } from 'react';
import { SpatialViewport, REGISTRY_BY_VIEW, SpatialControlPoint } from './SpatialViewport';
import type { MachineView } from './SpatialViewport';
import ArtifactRenderer from './ArtifactRenderer';
import ChecklistRenderer from './ChecklistRenderer';
import { useWorkbench, MiniExportPanel, fmtRegistry } from './WorkbenchOverlay';

const VIEW_LABELS: Record<MachineView, string> = {
    front:    'Front',
    interior: 'Interior',
    back:     'Rear',
};

interface LeftZoneProps {
    isPinned?: boolean;
    onTogglePin?: () => void;
    onClose?: () => void;
}

export function LeftZone({ isPinned, onTogglePin, onClose }: LeftZoneProps = {}) {
    const {
        spatialContext, pinnedArtifacts, removePinnedArtifact, activeView, setActiveView,
        activeChecklist, setActiveChecklist,
    } = useWorkbench();

    const [highlightedTargets, setHighlightedTargets] = useState<string[]>([]);
    const [drawPath,           setDrawPath]           = useState(false);
    const [navFlash,           setNavFlash]           = useState(false);
    const [registries,         setRegistries]         = useState(() => ({
        front:    { ...REGISTRY_BY_VIEW.front },
        interior: { ...REGISTRY_BY_VIEW.interior },
        back:     { ...REGISTRY_BY_VIEW.back },
    }));
    const [isModifyMode, setIsModifyMode] = useState(false);
    const [exportCode,   setExportCode]   = useState<string | null>(null);

    // Mirror agent spatial context → highlights + path flag + nav-flash
    // (activeView is updated in WorkbenchProvider so it stays in sync even when closed)
    useEffect(() => {
        if (!spatialContext) return;
        setHighlightedTargets(spatialContext.highlights);
        setDrawPath(spatialContext.draw_path ?? false);
        setNavFlash(true);
        const t = setTimeout(() => setNavFlash(false), 900);
        return () => clearTimeout(t);
    }, [spatialContext]);

    const registry = registries[activeView];

    const handleViewChange = useCallback((v: MachineView) => {
        if (isModifyMode) return;
        setActiveView(v);
        setHighlightedTargets([]);
        setDrawPath(false);
        setExportCode(null);
    }, [isModifyMode]);

    // Toggle a component in/out of the highlighted set
    const handleAnnotationClick = useCallback((point: SpatialControlPoint) => {
        const key = Object.keys(registry).find(k => registry[k].title === point.title);
        if (!key) return;
        setHighlightedTargets(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    }, [registry]);

    const handleSave = useCallback((draft: Record<string, SpatialControlPoint>) => {
        setRegistries(prev => ({ ...prev, [activeView]: { ...draft } }));
        setIsModifyMode(false);
        setExportCode(fmtRegistry(activeView, draft));
        // Keep only highlights that still exist in the saved draft
        setHighlightedTargets(prev => prev.filter(k => draft[k]));
    }, [activeView]);

    const handleDiscard = useCallback(() => setIsModifyMode(false), []);

    // Resolved points for the detail panel
    const highlightedPoints = highlightedTargets
        .map(k => ({ key: k, point: registry[k] }))
        .filter(({ point }) => !!point);

    return (
        <aside className={`bg-zinc-950 flex flex-col h-full overflow-hidden border-r transition-colors duration-300 ${
            navFlash ? 'border-orange-500/60' : 'border-zinc-800/80'
        }`}>
            {/* ── Brand strip ─────────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-3 py-2.5 border-b border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-orange-500/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-orange-400" viewBox="0 0 16 16" fill="none"
                            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                            <path d="M9 1.5L5.5 8.5H9L7 14.5l7.5-8H10l2-5H9z" fill="rgba(249,115,22,0.2)" />
                        </svg>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                        Workbench
                    </span>
                    {navFlash && (
                        <span className="relative flex h-1.5 w-1.5 ml-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {/* Coords edit button */}
                    <button
                        onClick={() => setIsModifyMode(m => { if (!m) setExportCode(null); return !m; })}
                        className={`text-[8px] font-mono px-2 py-1 rounded border transition-all ${
                            isModifyMode
                                ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                                : 'border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
                        }`}
                        title={isModifyMode ? 'Exit modify mode' : 'Edit pin coordinates'}
                    >
                        {isModifyMode ? '✎ Editing' : '✎ Coords'}
                    </button>
                    {onTogglePin && (
                        <button
                            onClick={onTogglePin}
                            title={isPinned ? 'Unpin (float)' : 'Pin sidebar'}
                            className={`text-[8px] font-mono px-2 py-1 rounded border transition-all ${
                                isPinned
                                    ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                                    : 'border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
                            }`}
                        >
                            {isPinned ? '◈ Pinned' : '◈ Pin'}
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            title="Close workbench"
                            className="text-[8px] font-mono px-2 py-1 rounded border border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400 transition-all"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* ── View switcher — industrial panel toggle ──────────────────── */}
            <div className="flex-shrink-0 px-2.5 py-2.5 border-b border-zinc-800/60">
                <div
                    className="relative flex rounded-md p-0.5 gap-0.5"
                    style={{
                        background: 'linear-gradient(180deg, #18181b 0%, #141416 100%)',
                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)',
                        border: '1px solid rgba(63,63,70,0.5)',
                    }}
                >
                    {(['front', 'interior', 'back'] as MachineView[]).map(v => {
                        const isActive = activeView === v;
                        return (
                            <button
                                key={v}
                                onClick={() => handleViewChange(v)}
                                disabled={isModifyMode}
                                className={`flex-1 relative py-1.5 rounded-[4px] text-[9px] font-mono font-bold uppercase tracking-[0.12em] transition-all duration-150 ${
                                    isActive
                                        ? 'text-amber-400 disabled:opacity-40'
                                        : 'text-zinc-600 hover:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed'
                                }`}
                                style={isActive ? {
                                    background: 'linear-gradient(180deg, rgba(63,63,70,0.9) 0%, rgba(39,39,42,0.95) 100%)',
                                    boxShadow: '0 1px 0 rgba(255,255,255,0.06), inset 0 1px 3px rgba(0,0,0,0.4)',
                                } : undefined}
                            >
                                {/* Glowing indicator dot above active label */}
                                {isActive && (
                                    <span
                                        className="absolute top-0.5 left-1/2 -translate-x-1/2 block w-1 h-1 rounded-full bg-amber-400"
                                        style={{ boxShadow: '0 0 6px rgba(245,158,11,0.9)' }}
                                    />
                                )}
                                {VIEW_LABELS[v]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── SpatialViewport ──────────────────────────────────────────── */}
            <div className="flex-shrink-0 p-1.5">
                <SpatialViewport
                    currentView={activeView}
                    registry={registry}
                    highlightedComponents={highlightedTargets}
                    drawPath={drawPath}
                    isModifyMode={isModifyMode}
                    isOverlay
                    onAnnotationClick={handleAnnotationClick}
                    onSave={handleSave}
                    onDiscard={handleDiscard}
                />
            </div>

            {/* ── Export panel (after save) ────────────────────────────────── */}
            {exportCode && (
                <div className="flex-shrink-0 px-2 pb-1">
                    <MiniExportPanel code={exportCode} onDismiss={() => setExportCode(null)} />
                </div>
            )}

            {/* ── Modify mode hint ─────────────────────────────────────────── */}
            {isModifyMode && (
                <div className="flex-shrink-0 mx-2 mb-1 border border-orange-500/20 bg-orange-500/5 rounded-lg px-2.5 py-2">
                    <p className="text-[9px] font-mono font-semibold text-orange-300 mb-1">Coordinate Edit Mode</p>
                    <ul className="text-[8.5px] text-zinc-500 leading-relaxed space-y-0.5 font-mono">
                        <li>· Drag any pin to reposition</li>
                        <li>· Drag <span className="text-orange-400">◆</span> handle to resize</li>
                        <li>· <span className="text-orange-400">Save ↵</span> commits</li>
                    </ul>
                </div>
            )}

            {/* ── Component detail card(s) ─────────────────────────────────── */}
            {!isModifyMode && (
                <div className="flex-shrink-0 px-2 pb-1">
                    {highlightedPoints.length > 0 ? (
                        <div className="border border-orange-500/25 bg-orange-500/5 rounded-lg overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-orange-500/15">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                                    <span className="text-[8px] font-mono font-bold uppercase tracking-[0.2em] text-orange-400">
                                        {highlightedPoints.length > 1 ? `Circuit · ${highlightedPoints.length}` : 'Locked'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setHighlightedTargets([])}
                                    className="text-zinc-700 hover:text-zinc-400 text-[10px] transition-colors"
                                    aria-label="Clear all highlights"
                                >✕</button>
                            </div>
                            {/* One row per highlighted component */}
                            {highlightedPoints.map(({ key, point }, i) => (
                                <div
                                    key={key}
                                    className={`px-2.5 py-2 ${i > 0 ? 'border-t border-orange-500/10' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-1">
                                        <p className="text-[11px] font-semibold text-zinc-100 leading-tight">
                                            {point.title}
                                        </p>
                                        <button
                                            onClick={() => setHighlightedTargets(prev => prev.filter(k => k !== key))}
                                            className="text-zinc-700 hover:text-zinc-500 text-[9px] flex-shrink-0 mt-px"
                                            aria-label={`Remove ${point.title}`}
                                        >✕</button>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">{point.desc}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="border border-zinc-800/40 rounded-lg px-2.5 py-2 text-center">
                            <p className="text-[10px] text-zinc-700 font-mono">Tap a marker to lock</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Active checklist ─────────────────────────────────────────── */}
            {activeChecklist && (
                <div className="flex-shrink-0 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/40">
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-[8px] font-mono font-bold uppercase tracking-[0.2em] text-amber-400">
                                Checklist
                            </span>
                        </div>
                        <button
                            onClick={() => setActiveChecklist(null)}
                            className="text-zinc-700 hover:text-zinc-400 text-[10px] transition-colors"
                            aria-label="Dismiss checklist"
                        >✕</button>
                    </div>
                    <div className="overflow-y-auto max-h-72">
                        <ChecklistRenderer
                            id={activeChecklist.id}
                            title={activeChecklist.title}
                            code={activeChecklist.code}
                        />
                    </div>
                </div>
            )}

            {/* ── Pinned artifacts list ────────────────────────────────────── */}
            {pinnedArtifacts.length > 0 && (
                <div className="flex-1 border-t border-zinc-800/60 overflow-y-auto min-h-0">
                    <div className="px-3 py-2">
                        <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-600">
                            Pinned · {pinnedArtifacts.length}
                        </span>
                    </div>
                    {pinnedArtifacts.map(a => (
                        <div key={a.id} className="mx-2 mb-2 border border-zinc-800/60 rounded-lg overflow-hidden bg-zinc-900/30">
                            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-800/40">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 uppercase flex-shrink-0">
                                        {a.type}
                                    </span>
                                    <span className="text-[10px] text-zinc-300 truncate">{a.title}</span>
                                </div>
                                <button
                                    onClick={() => removePinnedArtifact(a.id)}
                                    className="text-zinc-700 hover:text-zinc-400 text-[10px] transition-colors flex-shrink-0 ml-1"
                                    aria-label="Remove pinned artifact"
                                >✕</button>
                            </div>
                            <div className="p-1.5">
                                <ArtifactRenderer type={a.type} title={a.title} code={a.code} height={160} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </aside>
    );
}

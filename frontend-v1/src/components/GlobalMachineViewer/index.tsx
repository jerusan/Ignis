import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WrenchIcon } from 'lucide-react';
import {
    SpatialViewport,
    REGISTRY_BY_VIEW,
    SpatialControlPoint,
} from '../SpatialViewport';
import type { MachineView } from '../SpatialViewport';
import { useWorkbench, fmtRegistry, MiniExportPanel } from '../WorkbenchOverlay';
import ChecklistRenderer from '../ChecklistRenderer';
import ArtifactRenderer from '../ArtifactRenderer';
import BaselineGrid from '../BaselineGrid';
import AmperageDashboard from '../AmperageDashboard';
import PolarityConfigurator from '../PolarityConfigurator';

const VIEW_LABELS: Record<MachineView, string> = {
    front:    'Front',
    interior: 'Interior',
    back:     'Rear',
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.3;

// ── Zoom controls HUD ────────────────────────────────────────────────────────
interface ZoomHudProps {
    displayPct: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFit: () => void;
}

function ZoomHud({ displayPct, onZoomIn, onZoomOut, onFit }: ZoomHudProps) {
    return (
        <div
            className="absolute bottom-4 left-4 z-20 flex items-center gap-px rounded-lg overflow-hidden"
            style={{
                backgroundColor: 'rgba(10,11,14,0.92)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            }}
        >
            <button
                onClick={onZoomOut}
                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors text-lg font-light leading-none"
                title="Zoom out (scroll)"
                aria-label="Zoom out"
            >
                −
            </button>
            <button
                onClick={onFit}
                className="h-8 px-2.5 text-[10px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors tabular-nums border-x"
                style={{ borderColor: 'rgba(255,255,255,0.07)', minWidth: 48 }}
                title="Reset to fit (100%)"
                aria-label="Reset zoom"
            >
                {displayPct}%
            </button>
            <button
                onClick={onZoomIn}
                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors text-lg font-light leading-none"
                title="Zoom in (scroll)"
                aria-label="Zoom in"
            >
                +
            </button>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export function GlobalMachineViewer() {
    const { spatialContext, activeView, setActiveView, activeChecklist, activeArtifact, setActiveArtifact } = useWorkbench();

    // ── Workbench panel tab ───────────────────────────────────────────────────
    const [workbenchTab, setWorkbenchTab] = useState<'machine' | 'artifact' | 'baseline-grid' | 'amperage' | 'polarity'>('machine');

    useEffect(() => {
        if (activeArtifact) {
            setWorkbenchTab('artifact');
        } else {
            // When an artifact is dismissed, go back to machine — but preserve the
            // baseline-grid tab if the user was already there.
            setWorkbenchTab(prev => prev === 'artifact' ? 'machine' : prev);
        }
    }, [activeArtifact]);

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

    // ── Zoom / pan state ─────────────────────────────────────────────────────
    const [zoom, setZoom] = useState(1);
    const [pan,  setPan]  = useState({ x: 0, y: 0 });
    const viewportRef  = useRef<HTMLDivElement>(null);
    const contentRef   = useRef<HTMLDivElement>(null);
    const zoomViewRef  = useRef({ zoom: 1, panX: 0, panY: 0 });
    // Stores the fit zoom so resetView can access it without stale closure
    const fitZoomRef   = useRef(1);
    const [fitZoom,    setFitZoom] = useState(1);

    // Keep a ref to current zoom/pan for the non-reactive wheel handler
    zoomViewRef.current = { zoom, panX: pan.x, panY: pan.y };

    // ── Fit-to-view calculation ───────────────────────────────────────────────
    // Called on mount and whenever the viewport or content resizes (e.g. image load,
    // panel resize). Measures the content's natural layout height (transforms don't
    // affect offsetHeight) and sets the zoom so the full product is visible.
    const computeFit = useCallback(() => {
        const vp      = viewportRef.current;
        const content = contentRef.current;
        if (!vp || !content) return;
        const vpH     = vp.clientHeight;
        const contentH = content.offsetHeight;
        if (contentH < 10) return; // image not yet loaded
        const fit = vpH / contentH;
        fitZoomRef.current = fit;
        setFitZoom(fit);
        setZoom(fit);
        setPan({ x: 0, y: 0 });
    }, []);

    useEffect(() => {
        const ro = new ResizeObserver(computeFit);
        if (viewportRef.current) ro.observe(viewportRef.current);
        if (contentRef.current)  ro.observe(contentRef.current);
        computeFit();
        return () => ro.disconnect();
    }, [computeFit]);

    // Wheel handler — passive: false so we can preventDefault
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const { zoom: z, panX, panY } = zoomViewRef.current;
            const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
            const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor));
            setZoom(nz);
            setPan({ x: mx - (mx - panX) * (nz / z), y: my - (my - panY) * (nz / z) });
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    // ── Pan drag ─────────────────────────────────────────────────────────────
    const panState = useRef<{ startX: number; startY: number; started: boolean; pointerId: number } | null>(null);
    const [isPanning, setIsPanning] = useState(false);

    const handlePanPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        panState.current = { startX: e.clientX, startY: e.clientY, started: false, pointerId: e.pointerId };
    }, []);

    const handlePanPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const s = panState.current;
        if (!s) return;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (!s.started && Math.sqrt(dx * dx + dy * dy) > 5) {
            s.started = true;
            setIsPanning(true);
            (e.currentTarget as Element).setPointerCapture(s.pointerId);
        }
        if (s.started) {
            setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        }
    }, []);

    const handlePanPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (panState.current?.started) {
            (e.currentTarget as Element).releasePointerCapture(panState.current.pointerId);
        }
        panState.current = null;
        setIsPanning(false);
    }, []);

    // ── Zoom buttons ─────────────────────────────────────────────────────────
    const zoomIn = useCallback(() => {
        if (!viewportRef.current) return;
        const { clientWidth: w, clientHeight: h } = viewportRef.current;
        const { zoom: z, panX, panY } = zoomViewRef.current;
        const nz = Math.min(ZOOM_MAX, z * ZOOM_STEP);
        setZoom(nz);
        setPan({ x: w / 2 - (w / 2 - panX) * (nz / z), y: h / 2 - (h / 2 - panY) * (nz / z) });
    }, []);

    const zoomOut = useCallback(() => {
        if (!viewportRef.current) return;
        const { clientWidth: w, clientHeight: h } = viewportRef.current;
        const { zoom: z, panX, panY } = zoomViewRef.current;
        const nz = Math.max(ZOOM_MIN, z / ZOOM_STEP);
        setZoom(nz);
        setPan({ x: w / 2 - (w / 2 - panX) * (nz / z), y: h / 2 - (h / 2 - panY) * (nz / z) });
    }, []);

    const resetView = useCallback(() => {
        setZoom(fitZoomRef.current);
        setPan({ x: 0, y: 0 });
    }, []);

    // Reset zoom/pan when switching views
    const handleViewChange = useCallback((v: MachineView) => {
        if (isModifyMode) return;
        setActiveView(v);
        setWorkbenchTab('machine');
        setHighlightedTargets([]);
        setDrawPath(false);
        setExportCode(null);
        resetView();
    }, [isModifyMode, setActiveView, resetView]);

    // ── Sync with agent spatial context ──────────────────────────────────────
    useEffect(() => {
        if (!spatialContext) return;
        setHighlightedTargets(spatialContext.highlights);
        setDrawPath(spatialContext.draw_path ?? false);
        setNavFlash(true);
        const t = setTimeout(() => setNavFlash(false), 900);
        return () => clearTimeout(t);
    }, [spatialContext]);

    const registry = registries[activeView];

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
        setHighlightedTargets(prev => prev.filter(k => draft[k]));
    }, [activeView]);

    const handleDiscard = useCallback(() => setIsModifyMode(false), []);

    const highlightedPoints = highlightedTargets
        .map(k => ({ key: k, point: registry[k] }))
        .filter(({ point }) => !!point);

    return (
        <div
            className={`flex flex-col h-full transition-colors duration-300 ${
                navFlash ? 'border-l-2 border-orange-500/50' : 'border-l border-zinc-800/50'
            }`}
            style={{ backgroundColor: '#141418' }}
        >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <header
                className="flex-shrink-0 flex items-center justify-between px-5"
                style={{
                    height: 48,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    backgroundColor: '#0f1012',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                }}
            >
                <div className="flex items-center gap-2.5">
                    <WrenchIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#ff6b00' }} />
                    <span className="text-sm font-semibold" style={{ color: '#d4d8e4' }}>
                        Vulcan OmniPro 220
                    </span>
                    {navFlash && (
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#3d4760' }}>
                        Machine Viewer
                    </span>
                    <button
                        onClick={() => setIsModifyMode(m => { if (!m) setExportCode(null); return !m; })}
                        className={`text-[9px] font-mono px-2 py-1 rounded border transition-all ${
                            isModifyMode
                                ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                                : 'border-zinc-800 text-zinc-700 hover:border-zinc-700 hover:text-zinc-400'
                        }`}
                        title={isModifyMode ? 'Exit modify mode' : 'Edit pin coordinates'}
                    >
                        {isModifyMode ? '✎ Editing' : '✎ Coords'}
                    </button>
                </div>
            </header>

            {/* ── View tabs ───────────────────────────────────────────────── */}
            <div
                className="flex-shrink-0 flex items-center gap-3 px-5"
                style={{
                    height: 44,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    backgroundColor: '#111215',
                }}
            >
                {/* Machine view selector */}
                <div
                    className="relative flex rounded-md p-0.5 gap-0.5"
                    style={{
                        background: 'linear-gradient(180deg, #1e1e25 0%, #181820 100%)',
                        boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.7)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        opacity: workbenchTab === 'machine' ? 1 : 0.45,
                        transition: 'opacity 0.2s',
                    }}
                >
                    {(['front', 'interior', 'back'] as MachineView[]).map(v => {
                        const isActive = activeView === v && workbenchTab === 'machine';
                        return (
                            <button
                                key={v}
                                onClick={() => handleViewChange(v)}
                                disabled={isModifyMode}
                                className={`relative px-4 py-1.5 rounded-[3px] text-[10px] font-mono font-bold uppercase tracking-[0.15em] transition-all duration-150 min-w-[60px] ${
                                    isActive
                                        ? 'disabled:opacity-40'
                                        : 'text-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed'
                                }`}
                                style={isActive ? {
                                    color: '#ff6b00',
                                    background: 'linear-gradient(180deg, rgba(52,52,62,0.9) 0%, rgba(34,34,42,0.95) 100%)',
                                    boxShadow: '0 1px 0 rgba(255,255,255,0.04), inset 0 1px 2px rgba(0,0,0,0.6), 0 0 10px rgba(255,107,0,0.08)',
                                } : undefined}
                            >
                                {isActive && (
                                    <span
                                        className="absolute top-0.5 left-1/2 -translate-x-1/2 block w-1 h-1 rounded-full"
                                        style={{ backgroundColor: '#ff6b00', boxShadow: '0 0 6px rgba(255,107,0,0.9)' }}
                                    />
                                )}
                                {VIEW_LABELS[v]}
                            </button>
                        );
                    })}
                </div>

                {/* Artifact tab — appears when agent pushes an artifact to the workbench */}
                {activeArtifact && (
                    <>
                        <div className="w-px h-4 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />
                        <button
                            onClick={() => setWorkbenchTab('artifact')}
                            className="flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.12em] transition-all duration-150 min-w-0 max-w-[200px]"
                            style={workbenchTab === 'artifact' ? {
                                color: '#ff6b00',
                                background: 'linear-gradient(180deg, rgba(52,52,62,0.9) 0%, rgba(34,34,42,0.95) 100%)',
                                boxShadow: '0 1px 0 rgba(255,255,255,0.04), inset 0 1px 2px rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.07)',
                            } : {
                                color: '#5c6478',
                                border: '1px solid transparent',
                            }}
                        >
                            <span className="truncate">{activeArtifact.title}</span>
                            <span
                                onClick={(e) => { e.stopPropagation(); setActiveArtifact(null); }}
                                role="button"
                                aria-label="Close artifact"
                                className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded text-zinc-700 hover:text-zinc-200 hover:bg-white/10 transition-all leading-none ml-0.5 cursor-pointer"
                            >
                                ×
                            </span>
                        </button>
                    </>
                )}

                {/* Grid tab — always visible */}
                <div className="w-px h-4 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }} />
                <button
                    onClick={() => setWorkbenchTab('baseline-grid')}
                    className="px-3 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.12em] transition-all duration-150 flex-shrink-0"
                    style={workbenchTab === 'baseline-grid' ? {
                        color: '#ff6b00',
                        background: 'linear-gradient(180deg, rgba(52,52,62,0.9) 0%, rgba(34,34,42,0.95) 100%)',
                        boxShadow: '0 1px 0 rgba(255,255,255,0.04), inset 0 1px 2px rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.07)',
                    } : {
                        color: '#5c6478',
                        border: '1px solid transparent',
                    }}
                    title="Synergic parameter grid"
                >
                    Grid
                </button>

                {/* Power tab — always visible */}
                <button
                    onClick={() => setWorkbenchTab('amperage')}
                    className="px-3 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.12em] transition-all duration-150 flex-shrink-0"
                    style={workbenchTab === 'amperage' ? {
                        color: '#ff6b00',
                        background: 'linear-gradient(180deg, rgba(52,52,62,0.9) 0%, rgba(34,34,42,0.95) 100%)',
                        boxShadow: '0 1px 0 rgba(255,255,255,0.04), inset 0 1px 2px rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.07)',
                    } : {
                        color: '#5c6478',
                        border: '1px solid transparent',
                    }}
                    title="Amperage & power envelope"
                >
                    Power
                </button>

                {/* Polarity tab — always visible */}
                <button
                    onClick={() => setWorkbenchTab('polarity')}
                    className="px-3 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.12em] transition-all duration-150 flex-shrink-0"
                    style={workbenchTab === 'polarity' ? {
                        color: '#ff6b00',
                        background: 'linear-gradient(180deg, rgba(52,52,62,0.9) 0%, rgba(34,34,42,0.95) 100%)',
                        boxShadow: '0 1px 0 rgba(255,255,255,0.04), inset 0 1px 2px rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.07)',
                    } : {
                        color: '#5c6478',
                        border: '1px solid transparent',
                    }}
                    title="Process polarity & gas configurator"
                >
                    Polarity
                </button>
            </div>

            {/* ── Artifact canvas (replaces machine view when active) ──────── */}
            {workbenchTab === 'artifact' && activeArtifact && (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <ArtifactRenderer
                        key={activeArtifact.id}
                        id={activeArtifact.id}
                        type={activeArtifact.type}
                        title={activeArtifact.title}
                        code={activeArtifact.code}
                        source_pages={activeArtifact.source_pages}
                        fillHeight
                    />
                </div>
            )}

            {/* ── Baseline grid canvas ─────────────────────────────────────── */}
            {workbenchTab === 'baseline-grid' && (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <BaselineGrid />
                </div>
            )}

            {/* ── Amperage / power envelope canvas ────────────────────────── */}
            {workbenchTab === 'amperage' && (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <AmperageDashboard />
                </div>
            )}

            {/* ── Polarity configurator canvas ─────────────────────────────── */}
            {workbenchTab === 'polarity' && (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <PolarityConfigurator />
                </div>
            )}

            {/* ── Zoom / pan canvas ────────────────────────────────────────── */}
            {workbenchTab === 'machine' && <div className="flex-1 min-h-0 flex flex-col">
                {/* Viewport — shrinks to 60% when a checklist is active */}
                <div
                    ref={viewportRef}
                    className="min-h-0 relative overflow-hidden"
                    style={{
                        flex: activeChecklist && !isModifyMode ? '3 0 0' : '1 1 0',
                        cursor: isPanning ? 'grabbing' : 'grab',
                        backgroundColor: '#141418',
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                    }}
                    onPointerDown={handlePanPointerDown}
                    onPointerMove={handlePanPointerMove}
                    onPointerUp={handlePanPointerUp}
                    onPointerLeave={handlePanPointerUp}
                >
                    {/* Scaled + panned content */}
                    <div
                        ref={contentRef}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transformOrigin: '0 0',
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            willChange: 'transform',
                        }}
                    >
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

                    {/* Zoom HUD — bottom-left so the sidebar never covers it */}
                    <ZoomHud
                        displayPct={Math.round((zoom / fitZoom) * 100)}
                        onZoomIn={zoomIn}
                        onZoomOut={zoomOut}
                        onFit={resetView}
                    />

                    {/* ── Component detail sidebar ────────────────────────── */}
                    {!isModifyMode && (
                        <div
                            className="absolute top-0 right-0 h-full z-30 flex flex-col animate-fade-in"
                            style={{
                                width: '30%',
                                minWidth: 210,
                                maxWidth: 300,
                                backgroundColor: 'rgba(11,12,15,0.97)',
                                backdropFilter: 'blur(14px)',
                                borderLeft: '1px solid rgba(255,255,255,0.07)',
                            }}
                        >
                            {/* Sidebar header */}
                            <div
                                className="flex-shrink-0 flex items-center justify-between px-4 py-3"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                            >
                                <div className="flex items-center gap-2">
                                    {highlightedPoints.length > 0 && (
                                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
                                    )}
                                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-orange-400">
                                        {highlightedPoints.length > 1
                                            ? `Circuit · ${highlightedPoints.length} parts`
                                            : highlightedPoints.length === 1
                                                ? 'Component'
                                                : ''}
                                    </span>
                                </div>
                                {highlightedPoints.length > 0 && (
                                    <button
                                        onClick={() => setHighlightedTargets([])}
                                        className="w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-200 hover:bg-white/[.06] transition-all text-xs leading-none"
                                        aria-label="Clear selected components"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Component entries */}
                            <div className="flex-1 overflow-y-auto">
                                {highlightedPoints.map(({ key, point }, i) => (
                                    <div
                                        key={key}
                                        className="px-4 py-4"
                                        style={{
                                            borderBottom: i < highlightedPoints.length - 1
                                                ? '1px solid rgba(255,255,255,0.05)'
                                                : undefined,
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <p className="text-sm font-semibold leading-snug" style={{ color: '#e6e9ef' }}>
                                                {point.title}
                                            </p>
                                            {highlightedPoints.length > 1 && (
                                                <button
                                                    onClick={() => setHighlightedTargets(prev => prev.filter(k => k !== key))}
                                                    className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 text-[10px] mt-0.5 transition-colors"
                                                    aria-label={`Deselect ${point.title}`}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs leading-relaxed" style={{ color: '#5c6478' }}>
                                            {point.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Export panel ──────────────────────────────────────── */}
                {exportCode && (
                    <div className="flex-shrink-0 px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <MiniExportPanel code={exportCode} onDismiss={() => setExportCode(null)} />
                    </div>
                )}

                {/* ── Modify mode hints ─────────────────────────────────── */}
                {isModifyMode && (
                    <div
                        className="flex-shrink-0 mx-5 my-3 border border-orange-500/20 bg-orange-500/5 rounded-xl px-4 py-3"
                    >
                        <p className="text-[10px] font-mono font-semibold text-orange-300 mb-1.5">Coordinate Edit Mode</p>
                        <ul className="text-[9px] text-zinc-500 font-mono leading-relaxed space-y-0.5">
                            <li>· Drag any pin to reposition</li>
                            <li>· Drag <span className="text-orange-400">◆</span> handle to resize</li>
                            <li>· <span className="text-orange-400">Save ↵</span> to commit</li>
                        </ul>
                    </div>
                )}

                {/* ── Checklist controller — 40% of height when active ─── */}
                {activeChecklist && !isModifyMode && (
                    <div
                        className="min-h-0 overflow-y-auto"
                        style={{
                            flex: '2 0 0',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        <ChecklistRenderer
                            id={activeChecklist.id}
                            title={activeChecklist.title}
                            code={activeChecklist.code}
                        />
                    </div>
                )}

                {/* ── Hint bar — shown when no active checklist ─────────── */}
                {!isModifyMode && !activeChecklist && (
                    <div
                        className="flex-shrink-0 px-5 py-3.5"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#0f1012' }}
                    >
                        <p className="text-[10px] font-mono text-center tracking-wide" style={{ color: '#2e3852' }}>
                            Tap a marker to inspect · drag to pan · scroll to zoom
                        </p>
                    </div>
                )}
            </div>}
        </div>
    );
}

export default GlobalMachineViewer;

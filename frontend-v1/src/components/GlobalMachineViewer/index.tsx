import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

const MINI_W = 80;
const MINI_H = 60;

// ── Main component ────────────────────────────────────────────────────────────
export function GlobalMachineViewer() {
    const { spatialContext, activeView, setActiveView, activeChecklist, activeArtifact, setActiveArtifact, sessionState } = useWorkbench();

    // ── Workbench panel tab ───────────────────────────────────────────────────
    const [workbenchTab, setWorkbenchTab] = useState<'machine' | 'artifact' | 'baseline-grid' | 'amperage' | 'polarity'>('machine');

    useEffect(() => {
        if (activeArtifact) {
            setWorkbenchTab('artifact');
        } else {
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

    // ── Search ───────────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');

    // ── Zoom / pan state ─────────────────────────────────────────────────────
    const [zoom, setZoom] = useState(1);
    const [pan,  setPan]  = useState({ x: 0, y: 0 });
    const viewportRef  = useRef<HTMLDivElement>(null);
    const contentRef   = useRef<HTMLDivElement>(null);
    const zoomViewRef  = useRef({ zoom: 1, panX: 0, panY: 0 });
    const fitZoomRef   = useRef(1);
    const isFirstLayout = useRef(true);
    const lastFlownContextRef = useRef<SpatialContextTag | null>(null);
    const [fitZoom,    setFitZoom] = useState(1);

    // Dims for mini-map
    const [contentH,     setContentH]     = useState(0);
    const [viewportDims, setViewportDims] = useState({ w: 0, h: 0 });

    // View cross-fade
    const [viewOpacity, setViewOpacity] = useState(1);

    zoomViewRef.current = { zoom, panX: pan.x, panY: pan.y };

    // Stable refs for flyTo (avoids stale closures in the animation loop)
    const registriesRef = useRef(registries);
    registriesRef.current = registries;
    const activeViewRef = useRef(activeView);
    activeViewRef.current = activeView;

    // ── Fly-to animation ─────────────────────────────────────────────────────
    const flyAnimRef = useRef<number | null>(null);

    const cancelFlyTo = useCallback(() => {
        if (flyAnimRef.current !== null) {
            cancelAnimationFrame(flyAnimRef.current);
            flyAnimRef.current = null;
        }
    }, []);

    const flyTo = useCallback((
        keys: string[],
        reg?: Record<string, SpatialControlPoint>
    ) => {
        cancelFlyTo();
        const vp      = viewportRef.current;
        const content = contentRef.current;
        if (!vp || !content) return;

        const activeReg = reg ?? registriesRef.current[activeViewRef.current];
        const points    = keys.map(k => activeReg[k]).filter(Boolean);

        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

        if (!points.length) {
            const startZ  = zoomViewRef.current.zoom;
            const startPX = zoomViewRef.current.panX;
            const startPY = zoomViewRef.current.panY;
            const tgtZ    = fitZoomRef.current;
            const t0      = performance.now();
            const step = (now: number) => {
                const t = Math.min((now - t0) / 400, 1);
                const e = easeOut(t);
                setZoom(startZ + (tgtZ - startZ) * e);
                setPan({ x: startPX * (1 - e), y: startPY * (1 - e) });
                if (t < 1) flyAnimRef.current = requestAnimationFrame(step);
                else flyAnimRef.current = null;
            };
            flyAnimRef.current = requestAnimationFrame(step);
            return;
        }

        const vpW  = vp.clientWidth;
        const vpH  = vp.clientHeight;
        const cntW = content.offsetWidth;
        const cntH = content.offsetHeight;
        if (cntH < 10) return;

        const xs        = points.map(p => p.x);
        const ys        = points.map(p => p.y);
        const cx        = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy        = (Math.min(...ys) + Math.max(...ys)) / 2;
        const xSpreadPx = (Math.max(...xs) - Math.min(...xs)) / 1000 * cntW;
        const ySpreadPx = (Math.max(...ys) - Math.min(...ys)) / 1000 * cntH;
        const spreadPx  = Math.max(xSpreadPx, ySpreadPx, 40);

        const targetZoom = Math.min(Math.min(vpW / spreadPx, vpH / spreadPx) * 0.6, ZOOM_MAX);
        const targetPanX = vpW / 2 - (cx / 1000 * cntW) * targetZoom;
        const targetPanY = vpH / 2 - (cy / 1000 * cntH) * targetZoom;

        const startZ  = zoomViewRef.current.zoom;
        const startPX = zoomViewRef.current.panX;
        const startPY = zoomViewRef.current.panY;
        const t0      = performance.now();
        const dur     = 500;

        const step = (now: number) => {
            const t = Math.min((now - t0) / dur, 1);
            const e = easeOut(t);
            setZoom(startZ  + (targetZoom - startZ)  * e);
            setPan({
                x: startPX + (targetPanX - startPX) * e,
                y: startPY + (targetPanY - startPY) * e,
            });
            if (t < 1) flyAnimRef.current = requestAnimationFrame(step);
            else flyAnimRef.current = null;
        };
        flyAnimRef.current = requestAnimationFrame(step);
    }, [cancelFlyTo]);

    // ── Fit-to-view calculation ───────────────────────────────────────────────
    const computeFit = useCallback(() => {
        const vp      = viewportRef.current;
        const content = contentRef.current;
        if (!vp || !content) return;
        const vpH  = vp.clientHeight;
        const vpW  = vp.clientWidth;
        const cntH = content.offsetHeight;
        const cntW = content.offsetWidth;
        if (cntH < 10 || cntW < 10) return;
        const fit = Math.min(vpH / cntH, vpW / cntW);

        const prevFitZoom = fitZoomRef.current;
        fitZoomRef.current = fit;
        setFitZoom(fit);

        const isAtFit = Math.abs(zoomViewRef.current.zoom - prevFitZoom) < 0.02;
        if (isFirstLayout.current || isAtFit) {
            setZoom(fit);
            setPan({ x: 0, y: 0 });
            isFirstLayout.current = false;
        }

        setContentH(cntH);
        setViewportDims({ w: vpW, h: vpH });
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
            cancelFlyTo();
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
    }, [cancelFlyTo]);
    // View switch with 150 ms cross-fade
    const handleViewChange = useCallback((v: MachineView) => {
        if (isModifyMode || v === activeView) return;
        cancelFlyTo();
        setViewOpacity(0);
        setTimeout(() => {
            setActiveView(v);
            setWorkbenchTab('machine');
            setHighlightedTargets([]);
            setDrawPath(false);
            setExportCode(null);
            setSearchQuery('');
            setViewOpacity(1);
            requestAnimationFrame(() => {
                setZoom(fitZoomRef.current);
                setPan({ x: 0, y: 0 });
            });
        }, 150);
    }, [isModifyMode, activeView, setActiveView, cancelFlyTo]);


    // ── Pan drag ─────────────────────────────────────────────────────────────
    const panState = useRef<{ startX: number; startY: number; started: boolean; pointerId: number; startTime: number } | null>(null);
    const [isPanning, setIsPanning] = useState(false);

    const handlePanPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        panState.current = { startX: e.clientX, startY: e.clientY, started: false, pointerId: e.pointerId, startTime: Date.now() };
    }, []);

    const handlePanPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const s = panState.current;
        if (!s) return;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (!s.started && Math.sqrt(dx * dx + dy * dy) > 5) {
            s.started = true;
            setIsPanning(true);
            cancelFlyTo();
            (e.currentTarget as Element).setPointerCapture(s.pointerId);
        }
        if (s.started) {
            setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        }
    }, [cancelFlyTo]);

    const handlePanPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const s = panState.current;
        if (s?.started) {
            (e.currentTarget as Element).releasePointerCapture(s.pointerId);
            
            const dx = e.clientX - s.startX;
            const dy = e.clientY - s.startY;
            const dt = Date.now() - s.startTime;
            
            if (dt < 400 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && zoomViewRef.current.zoom <= fitZoomRef.current * 1.05) {
                const VIEWS: MachineView[] = ['front', 'interior', 'back'];
                const currentIndex = VIEWS.indexOf(activeViewRef.current);
                if (dx > 0) {
                    const nextIndex = (currentIndex + 1) % VIEWS.length;
                    handleViewChange(VIEWS[nextIndex]);
                } else {
                    const prevIndex = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
                    handleViewChange(VIEWS[prevIndex]);
                }
            }
        }
        panState.current = null;
        setIsPanning(false);
    }, [handleViewChange]);

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
        cancelFlyTo();
        setZoom(fitZoomRef.current);
        setPan({ x: 0, y: 0 });
    }, [cancelFlyTo]);

    // ── Sync with agent spatial context ──────────────────────────────────────
    useEffect(() => {
        if (!spatialContext) {
            setHighlightedTargets([]);
            setDrawPath(false);
            resetView();
            lastFlownContextRef.current = null;
            return;
        }
        setHighlightedTargets(spatialContext.highlights);
        setDrawPath(spatialContext.draw_path ?? false);
        setNavFlash(true);
        const t = setTimeout(() => setNavFlash(false), 900);

        const vp = viewportRef.current;
        const content = contentRef.current;
        if (vp && content && content.offsetHeight >= 10) {
            flyTo(spatialContext.highlights, registries[spatialContext.view]);
            lastFlownContextRef.current = spatialContext;
        } else {
            lastFlownContextRef.current = null;
        }

        return () => clearTimeout(t);
    }, [spatialContext, resetView, registries, flyTo]);

    // Ensure we fly to the active spatial context once elements are laid out / have sizes
    useEffect(() => {
        if (spatialContext && lastFlownContextRef.current !== spatialContext && contentH >= 10 && viewportDims.w > 0) {
            flyTo(spatialContext.highlights, registries[spatialContext.view]);
            lastFlownContextRef.current = spatialContext;
        }
    }, [spatialContext, contentH, viewportDims, flyTo, registries]);

    const registry = registries[activeView];

    // ── Search filter ─────────────────────────────────────────────────────────
    const filteredKeys = useMemo(() => {
        if (!searchQuery) return [];
        const q = searchQuery.toLowerCase();
        return Object.entries(registry)
            .filter(([key, pt]) =>
                key.toLowerCase().includes(q) ||
                pt.title.toLowerCase().includes(q)
            )
            .map(([key]) => key);
    }, [searchQuery, registry]);

    // ── Polarity-aware path direction ─────────────────────────────────────────
    const pathDirection: 'forward' | 'reverse' =
        sessionState?.process?.toLowerCase().includes('dcen') ? 'reverse' : 'forward';

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

    // Sidebar: show search results when a query is active
    const sidebarPoints = searchQuery
        ? filteredKeys.map(k => ({ key: k, point: registry[k] })).filter(({ point }) => !!point)
        : highlightedPoints;

    // ── Mini-map ──────────────────────────────────────────────────────────────
    const miniScale  = contentH > 0 && viewportDims.w > 0
        ? Math.min(MINI_W / viewportDims.w, MINI_H / contentH)
        : 0;
    const miniRectX  = (-pan.x / zoom) * miniScale;
    const miniRectY  = (-pan.y / zoom) * miniScale;
    const miniRectW  = (viewportDims.w / zoom) * miniScale;
    const miniRectH  = (viewportDims.h / zoom) * miniScale;
    const showMiniMap = zoom > fitZoom * 1.15 && miniScale > 0 && workbenchTab === 'machine';

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
                    {/* Component search bar — right of header, before Coords button */}
                    <input
                        type="text"
                        placeholder="Search components…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setSearchQuery(''); }}
                        className="text-[10px] font-mono rounded px-2 py-1 focus:outline-none w-36 transition-colors"
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: `1px solid ${searchQuery ? 'rgba(251,146,60,0.45)' : 'rgba(255,255,255,0.08)'}`,
                            color: searchQuery ? '#d4d8e4' : '#5c6478',
                        }}
                    />
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

                {/* Artifact tab */}
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

                {/* Grid tab */}
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

                {/* Power tab */}
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

                {/* Polarity tab */}
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

            {/* ── Artifact canvas ──────────────────────────────────────────── */}
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
            {workbenchTab === 'machine' && <div className="flex-1 min-h-0 flex flex-row">
                {/* Viewport (Product Viewer) */}
                <div
                    ref={viewportRef}
                    className="flex-1 min-h-0 w-0 relative overflow-hidden"
                    style={{
                        cursor: isPanning ? 'grabbing' : 'grab',
                        backgroundColor: '#121315',
                        backgroundImage: `
                            radial-gradient(circle at center, rgba(44,48,54,0.4) 0%, transparent 65%),
                            linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)
                        `,
                        backgroundSize: '100% 100%, 32px 32px, 32px 32px',
                    }}
                    onPointerDown={handlePanPointerDown}
                    onPointerMove={handlePanPointerMove}
                    onPointerUp={handlePanPointerUp}
                    onPointerLeave={handlePanPointerUp}
                >
                    {/* Scaled + panned content — opacity fades on view switch */}
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
                            opacity: viewOpacity,
                            transition: 'opacity 150ms ease-in-out',
                        }}
                    >
                        <SpatialViewport
                            currentView={activeView}
                            registry={registry}
                            highlightedComponents={highlightedTargets}
                            searchHighlights={filteredKeys.length > 0 ? filteredKeys : undefined}
                            drawPath={drawPath}
                            drawPathAnimated={drawPath}
                            pathDirection={pathDirection}
                            isModifyMode={isModifyMode}
                            isOverlay
                            transparent
                            onAnnotationClick={handleAnnotationClick}
                            onSave={handleSave}
                            onDiscard={handleDiscard}
                        />
                    </div>

                    {/* ── Mini-map — bottom-right, above ZoomHud ──────────── */}
                    {showMiniMap && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: 56,
                                right: 16,
                                width: MINI_W,
                                height: MINI_H,
                                overflow: 'hidden',
                                borderRadius: 4,
                                border: '1px solid rgba(255,255,255,0.14)',
                                backgroundColor: '#0a0b0e',
                                zIndex: 25,
                                pointerEvents: 'none',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.7)',
                            }}
                        >
                            {/* Scaled-down full machine view */}
                            <div style={{
                                transform: `scale(${miniScale})`,
                                transformOrigin: '0 0',
                                width: viewportDims.w,
                                height: contentH,
                                pointerEvents: 'none',
                            }}>
                                <SpatialViewport
                                    currentView={activeView}
                                    registry={registry}
                                    highlightedComponents={highlightedTargets}
                                    drawPath={false}
                                    isOverlay
                                    transparent
                                    pathDirection={pathDirection}
                                />
                            </div>
                            {/* Viewport window rectangle */}
                            <div style={{
                                position: 'absolute',
                                left: miniRectX,
                                top: miniRectY,
                                width: Math.max(4, miniRectW),
                                height: Math.max(4, miniRectH),
                                border: '1.5px solid rgba(255,255,255,0.85)',
                                borderRadius: 2,
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                pointerEvents: 'none',
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                            }} />
                        </div>
                    )}

                    {/* Zoom HUD — bottom-left so the sidebar never covers it */}
                    <ZoomHud
                        displayPct={Math.round((zoom / fitZoom) * 100)}
                        onZoomIn={zoomIn}
                        onZoomOut={zoomOut}
                        onFit={resetView}
                    />
                </div>

                {/* ── Component Section (Right Sidebar) ────────────────────────── */}
                <div
                    className="flex-shrink-0 flex flex-col border-l border-zinc-800/80 w-[350px] h-full"
                    style={{ backgroundColor: '#0b0c0f' }}
                >
                    {/* Component entries/details (only if search active or points highlighted) */}
                    {!isModifyMode && (sidebarPoints.length > 0 || searchQuery) && (
                        <div
                            className={`flex flex-col flex-1 min-h-0 ${
                                activeChecklist ? 'border-b border-zinc-800/60' : ''
                            }`}
                        >
                            {/* Sidebar header */}
                            <div
                                className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-[#0f1012]"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                            >
                                <div className="flex items-center gap-2">
                                    {sidebarPoints.length > 0 && (
                                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
                                    )}
                                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-orange-400">
                                        {searchQuery
                                            ? `Search · ${sidebarPoints.length} match${sidebarPoints.length !== 1 ? 'es' : ''}`
                                            : sidebarPoints.length > 1
                                                ? `Circuit · ${sidebarPoints.length} parts`
                                                : sidebarPoints.length === 1
                                                    ? 'Component'
                                                    : ''}
                                    </span>
                                </div>
                                {searchQuery ? (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-200 hover:bg-white/[.06] transition-all text-xs leading-none"
                                        aria-label="Clear search"
                                    >
                                        ✕
                                    </button>
                                ) : sidebarPoints.length > 0 ? (
                                    <button
                                        onClick={() => setHighlightedTargets([])}
                                        className="w-6 h-6 flex items-center justify-center rounded text-zinc-650 hover:text-zinc-200 hover:bg-white/[.06] transition-all text-xs leading-none"
                                        aria-label="Clear selected components"
                                    >
                                        ✕
                                    </button>
                                ) : null}
                            </div>

                            {/* Component entries */}
                            <div className="flex-1 overflow-y-auto bg-[#0a0b0d]">
                                {sidebarPoints.map(({ key, point }, i) => (
                                    <div
                                        key={key}
                                        className="px-4 py-4"
                                        style={{
                                            borderBottom: i < sidebarPoints.length - 1
                                                ? '1px solid rgba(255,255,255,0.05)'
                                                : undefined,
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <p className="text-sm font-semibold leading-snug" style={{ color: '#e6e9ef' }}>
                                                {point.title}
                                            </p>
                                            {!searchQuery && sidebarPoints.length > 1 && (
                                                <button
                                                    onClick={() => setHighlightedTargets(prev => prev.filter(k => k !== key))}
                                                    className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 text-[10px] mt-0.5 transition-colors"
                                                    aria-label={`Deselect ${point.title}`}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs leading-relaxed font-sans text-zinc-400">
                                            {point.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Default state if no checklist and no components are selected/searched */}
                    {!isModifyMode && !activeChecklist && sidebarPoints.length === 0 && !searchQuery && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#0a0b0d]">
                            <svg className="w-8 h-8 mb-2.5 opacity-20 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                            </svg>
                            <p className="text-[11px] font-sans leading-relaxed text-zinc-500">
                                Select a component pin on the machine layout or search components to view detailed wiring specifications and guidance.
                            </p>
                        </div>
                    )}

                    {/* Active Checklist */}
                    {activeChecklist && !isModifyMode && (
                        <div className="flex-1 min-h-0 flex flex-col bg-[#0f1012]">
                            <div className="flex-1 min-h-0 overflow-y-auto">
                                <ChecklistRenderer
                                    id={activeChecklist.id}
                                    title={activeChecklist.title}
                                    code={activeChecklist.code}
                                />
                            </div>
                        </div>
                    )}

                    {/* Coordinate Edit Mode Hints */}
                    {isModifyMode && (
                        <div className="flex-1 flex flex-col justify-between p-4 bg-[#0a0b0d]">
                            <div className="border border-orange-500/20 bg-orange-500/5 rounded-xl px-4 py-3">
                                <p className="text-[10px] font-mono font-semibold text-orange-300 mb-1.5">Coordinate Edit Mode</p>
                                <ul className="text-[9px] text-zinc-500 font-mono leading-relaxed space-y-0.5">
                                    <li>· Drag any pin to reposition</li>
                                    <li>· Drag <span className="text-orange-400">◆</span> handle to resize</li>
                                    <li>· <span className="text-orange-400">Save ↵</span> to commit</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Export Panel */}
                    {exportCode && (
                        <div className="flex-shrink-0 px-4 py-3 bg-[#0a0b0d]" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <MiniExportPanel code={exportCode} onDismiss={() => setExportCode(null)} />
                        </div>
                    )}

                    {/* Bottom Hint Bar */}
                    {!isModifyMode && !activeChecklist && (
                        <div
                            className="flex-shrink-0 px-4 py-3.5 bg-[#0f1012]"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                        >
                            <p className="text-[10px] font-mono text-center tracking-wide text-zinc-500">
                                Tap a marker to inspect · drag to pan · scroll to zoom
                            </p>
                        </div>
                    )}
                </div>
            </div>}
        </div>
    );
}

export default GlobalMachineViewer;

// frontend/src/components/WorkbenchOverlay.tsx
//
// Self-contained "Garage Workbench" overlay that floats over the chat panel.
// Exports:
//   WorkbenchProvider  – wraps the app; manages open/pin/telemetry state
//   useWorkbench       – hook to read/drive the overlay from anywhere
//   WorkbenchOverlay   – the actual floating panel + launcher button
//
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import {
    SpatialViewport,
    SpatialControlPoint,
    WELDER_CONSOLE_REGISTRY,
    WelderTelemetry,
} from './SpatialViewport';
import type { ChatArtifact } from './ChatPane';

// ── Re-export so consumers can import from one place ──────────────────────────
export type { WelderTelemetry };

// ── Registry export formatter (mirrors App.tsx helper) ────────────────────────
function fmtRegistry(draft: Record<string, SpatialControlPoint>): string {
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
    return `export const WELDER_CONSOLE_REGISTRY: Record<string, SpatialControlPoint> = {\n${entries.join(',\n')}\n};`;
}

// ── Context ────────────────────────────────────────────────────────────────────
interface WorkbenchCtx {
    isOpen:       boolean;
    isPinned:     boolean;
    telemetry:    WelderTelemetry | undefined;
    artifacts:    ChatArtifact[];
    open:         () => void;
    close:        () => void;
    toggleOpen:   () => void;
    togglePin:    () => void;
    setTelemetry: (t: WelderTelemetry | undefined) => void;
    setArtifacts: (a: ChatArtifact[]) => void;
}

const WorkbenchContext = createContext<WorkbenchCtx | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────
export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
    const [isOpen,    setIsOpen]    = useState(false);
    const [isPinned,  setIsPinned]  = useState(false);
    const [telemetry, setTelemetry] = useState<WelderTelemetry | undefined>();
    const [artifacts, setArtifacts] = useState<ChatArtifact[]>([]);

    const open       = useCallback(() => setIsOpen(true),       []);
    const close      = useCallback(() => setIsOpen(false),      []);
    const toggleOpen = useCallback(() => setIsOpen(v => !v),    []);
    const togglePin  = useCallback(() => setIsPinned(v => !v),  []);

    // Esc closes the panel unless it's pinned
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isPinned) setIsOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, isPinned]);

    return (
        <WorkbenchContext.Provider
            value={{ isOpen, isPinned, telemetry, artifacts, open, close, toggleOpen, togglePin, setTelemetry, setArtifacts }}
        >
            {children}
        </WorkbenchContext.Provider>
    );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useWorkbench(): WorkbenchCtx {
    const ctx = useContext(WorkbenchContext);
    if (!ctx) throw new Error('useWorkbench must be used inside <WorkbenchProvider>');
    return ctx;
}

// ── Inline mini export panel ───────────────────────────────────────────────────
function MiniExportPanel({ code, onDismiss }: { code: string; onDismiss: () => void }) {
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

// ── WorkbenchOverlay ───────────────────────────────────────────────────────────
export function WorkbenchOverlay() {
    const { isOpen, isPinned, telemetry, open, close, togglePin } = useWorkbench();

    // Self-contained viewport state — decoupled from the sidebar's SpatialViewport
    const [registry,     setRegistry]     = useState<Record<string, SpatialControlPoint>>(
        () => ({ ...WELDER_CONSOLE_REGISTRY })
    );
    const [activeTarget, setActiveTarget] = useState<string | undefined>('lcd_display');
    const [isModifyMode, setIsModifyMode] = useState(false);
    const [exportCode,   setExportCode]   = useState<string | null>(null);

    const handleToggleModify = useCallback(() => {
        setIsModifyMode(m => { if (!m) setExportCode(null); return !m; });
    }, []);

    const handleSave = useCallback((draft: Record<string, SpatialControlPoint>) => {
        setRegistry({ ...draft });
        setIsModifyMode(false);
        setExportCode(fmtRegistry(draft));
        setActiveTarget(prev => (prev && draft[prev] ? prev : undefined));
    }, []);

    const handleDiscard = useCallback(() => setIsModifyMode(false), []);

    const handleAnnotationClick = useCallback((point: SpatialControlPoint) => {
        const key = Object.keys(registry).find(k => registry[k].title === point.title);
        if (key) setActiveTarget(prev => prev === key ? undefined : key);
    }, [registry]);

    const activePoint = activeTarget ? registry[activeTarget] : null;

    // ── Launcher (edge tab, visible when panel is closed) ─────────────────────
    // Note: use translateY(-50%) not translate(0%,-50%) — the latter can produce
    // a phantom X offset due to percentage-based translate resolution in some
    // browser/renderer combinations.
    const launcherStyle: React.CSSProperties = {
        position:      'fixed',
        left:          0,
        top:           '50%',
        zIndex:        51,          // above scrim (40) so it's always clickable
        transform:     isOpen ? 'translate(-115%, -50%)' : 'translateY(-50%)',
        opacity:       isOpen ? 0 : 1,
        pointerEvents: isOpen ? 'none' : 'auto',
        transition:    'transform 0.3s ease-out, opacity 0.22s ease',
    };

    // ── Panel (slides in from the left) ──────────────────────────────────────
    const panelStyle: React.CSSProperties = {
        position:     'fixed',
        left:         16,
        top:          16,
        zIndex:       50,
        width:        440,
        maxHeight:    'calc(100vh - 24px)',
        transform:    isOpen ? 'translateX(0)' : 'translateX(-108%)',
        opacity:      isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
        transition:   'transform 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease',
    };

    return (
        <>
            {/* ── Launcher tab ──────────────────────────────────────────────────── */}
            <button
                onClick={open}
                aria-label="Open Garage Workbench"
                style={launcherStyle}
                className="
                    flex flex-col items-center justify-center gap-2
                    w-9 h-[72px]
                    bg-zinc-950/97 backdrop-blur-xl
                    border border-l-0 border-zinc-700/70
                    hover:border-orange-500/50 hover:bg-zinc-900
                    rounded-r-2xl
                    shadow-xl shadow-black/50
                    group
                "
            >
                {/* Bolt / spark icon */}
                <svg
                    className="w-4 h-4 text-orange-500 group-hover:text-orange-400 transition-colors flex-shrink-0"
                    viewBox="0 0 16 16" fill="none" stroke="currentColor"
                    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                >
                    <path d="M9 1.5L5.5 8.5H9L7 14.5l7.5-8H10l2-5H9z" fill="rgba(249,115,22,0.18)" />
                </svg>
                {/* Vertical label */}
                <span
                    className="text-[7px] font-mono font-bold text-zinc-500 group-hover:text-orange-500/70 uppercase tracking-widest transition-colors"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                    Bench
                </span>
            </button>

            {/* ── Scrim — backdrop tap closes when not pinned ───────────────────── */}
            {isOpen && !isPinned && (
                <div
                    className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
                    onClick={close}
                    aria-hidden
                />
            )}

            {/* ── Overlay panel ─────────────────────────────────────────────────── */}
            <div
                role="dialog"
                aria-label="Garage Workbench — Vulcan Front Console"
                aria-modal={!isPinned}
                style={panelStyle}
                className="
                    flex flex-col
                    bg-zinc-950/95 backdrop-blur-2xl
                    border border-zinc-800/80
                    rounded-2xl
                    shadow-2xl shadow-black/80
                    overflow-hidden
                "
            >
                {/* ─ Header ───────────────────────────────────────────────────── */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/50">
                    <div className="flex items-center gap-2.5">
                        {/* Bolt badge */}
                        <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-orange-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                                <path d="M9 1.5L5.5 8.5H9L7 14.5l7.5-8H10l2-5H9z" fill="rgba(249,115,22,0.2)" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-[11px] font-mono font-bold text-zinc-200 uppercase tracking-[0.14em]">
                                Garage Workbench
                            </div>
                            <div className="text-[9px] font-mono text-zinc-600 mt-0.5">
                                Vulcan OmniPro 220 — Front Console
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* ✎ Edit coords */}
                        <button
                            onClick={handleToggleModify}
                            className={`
                                min-h-[32px] text-[9px] font-mono font-semibold px-2.5 py-1
                                rounded-lg border transition-all
                                ${isModifyMode
                                    ? 'bg-orange-500/15 border-orange-500/50 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]'
                                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'}
                            `}
                            title={isModifyMode ? 'Exit modify mode' : 'Edit pin coordinates'}
                        >
                            {isModifyMode ? '✎ Editing' : '✎ Coords'}
                        </button>

                        {/* 📌 Pin */}
                        <button
                            onClick={togglePin}
                            className={`
                                min-h-[32px] min-w-[32px] flex items-center justify-center
                                rounded-lg border transition-all
                                ${isPinned
                                    ? 'bg-sky-500/15 border-sky-500/50 text-sky-400'
                                    : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'}
                            `}
                            title={isPinned ? 'Unpin — allow Esc to close' : 'Pin open while troubleshooting'}
                        >
                            {/* Pushpin SVG */}
                            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4.5 1h5v4.5l2 2.5H2.5l2-2.5V1zM7 8v5M4.5 1h5" />
                            </svg>
                        </button>

                        {/* ✕ Close */}
                        <button
                            onClick={close}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-300 transition-colors"
                            title="Close workbench (Esc)"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M2 2l10 10M12 2L2 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ─ Scrollable body ──────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">

                    {/* Viewport */}
                    <div className="p-2">
                        <SpatialViewport
                            activeComponent={isModifyMode ? undefined : activeTarget}
                            registry={registry}
                            isModifyMode={isModifyMode}
                            isOverlay
                            telemetry={telemetry}
                            onAnnotationClick={handleAnnotationClick}
                            onSave={handleSave}
                            onDiscard={handleDiscard}
                        />
                    </div>

                    {/* Export panel */}
                    {exportCode && (
                        <div className="px-2 pb-0 pt-2">
                            <MiniExportPanel code={exportCode} onDismiss={() => setExportCode(null)} />
                        </div>
                    )}

                    {/* Selected component detail */}
                    {!isModifyMode && (
                        <div className="px-3 pt-2 pb-0">
                            {activePoint && activeTarget ? (
                                <div className="border border-orange-500/25 bg-orange-500/5 rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-orange-500/15">
                                        <div className="flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                                            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-orange-400">
                                                Console Lock
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-mono text-zinc-600 tabular-nums">
                                                {registry[activeTarget].x} · {registry[activeTarget].y}
                                            </span>
                                            <button
                                                onClick={() => setActiveTarget(undefined)}
                                                className="text-zinc-700 hover:text-zinc-400 text-[10px] leading-none transition-colors"
                                                aria-label="Clear selection"
                                            >✕</button>
                                        </div>
                                    </div>
                                    <div className="px-3 py-2.5">
                                        <p className="text-[13px] font-semibold text-zinc-50 leading-tight">{activePoint.title}</p>
                                        <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">{activePoint.desc}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-zinc-800/40 rounded-xl px-3 py-2.5 text-center">
                                    <p className="text-[11px] text-zinc-600 font-mono">Tap a marker to lock a component</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Modify mode hint */}
                    {isModifyMode && (
                        <div className="mx-3 mt-2 border border-orange-500/20 bg-orange-500/5 rounded-xl px-3 py-2.5">
                            <div className="flex items-start gap-2">
                                <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border border-orange-500/40 flex items-center justify-center">
                                    <span className="text-orange-400 text-[8px] font-bold">i</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-mono font-semibold text-orange-300 mb-1">
                                        Coordinate Modify Mode
                                    </p>
                                    <ul className="text-[9.5px] text-zinc-500 leading-relaxed space-y-0.5 font-mono">
                                        <li>· Drag any pin to reposition</li>
                                        <li>· Drag <span className="text-orange-400">◆</span> handle to resize radius</li>
                                        <li>· <span className="text-orange-400">Save ↵</span> commits and exports registry</li>
                                        <li>· Discard reverts all changes</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Component registry grid */}
                    {!isModifyMode && (
                        <div className="px-3 pt-3 pb-4">
                            <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 block mb-2">
                                Component Registry
                            </span>
                            <div className="grid grid-cols-2 gap-1">
                                {Object.entries(registry).map(([key, point]) => (
                                    <button
                                        key={key}
                                        onClick={() => setActiveTarget(prev => prev === key ? undefined : key)}
                                        className={`
                                            min-h-[36px] text-left rounded-lg px-2.5 py-2
                                            text-[11px] font-sans transition-all border
                                            ${activeTarget === key
                                                ? 'bg-orange-500/10 border-orange-500/40 text-zinc-100'
                                                : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}
                                        `}
                                    >
                                        <span className="line-clamp-1 leading-tight">{point.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ─ Status bar ───────────────────────────────────────────────── */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-zinc-800/60 bg-zinc-900/30">
                    <div className="flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${telemetry ? 'bg-green-400' : 'bg-orange-400'} opacity-60`} />
                            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${telemetry ? 'bg-green-500' : 'bg-orange-500'}`} />
                        </span>
                        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                            {telemetry ? 'Telemetry Active' : 'Handoff Stream'}
                        </span>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-700 tabular-nums">
                        {Object.keys(registry).length} components
                    </span>
                </div>
            </div>
        </>
    );
}

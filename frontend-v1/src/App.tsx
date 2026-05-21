// frontend/src/App.tsx
import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ComponentPage } from './components/ComponentPage';
import { ComponentPreviewPage } from './components/ComponentPreviewPage';
import { ComponentsPage } from './components/ComponentsPage';
import { IgnisApp } from './components/IgnisApp';
import { WorkbenchProvider, useWorkbench } from './components/WorkbenchOverlay';
import { LeftZone } from './components/LeftZone';
import { SpatialViewport, REGISTRY_BY_VIEW } from './components/SpatialViewport';

// ── PiP machine overlay ────────────────────────────────────────────────────
// States: hidden (FAB only) → pip (compact floating thumbnail) → full (wide panel)
function MachineOverlay() {
    const { spatialContext, activeView, isOpen, open, close } = useWorkbench();
    const [pipVisible, setPipVisible] = useState(false);

    // Stable key so we only trigger on content changes, not streaming re-renders
    const spatialKey = spatialContext
        ? `${spatialContext.view}:${[...spatialContext.highlights].sort().join(',')}`
        : '';
    const prevSpatialKey = useRef('');

    // Auto-show PiP when a new spatial context arrives
    useEffect(() => {
        if (spatialKey && spatialKey !== prevSpatialKey.current) {
            prevSpatialKey.current = spatialKey;
            if (!isOpen) setPipVisible(true);
        }
    }, [spatialKey, isOpen]);

    // Full panel opens (e.g. checklist auto-trigger) → hide PiP
    useEffect(() => {
        if (isOpen) setPipVisible(false);
    }, [isOpen]);

    const registry = REGISTRY_BY_VIEW[activeView];
    const VIEW_LABEL: Record<string, string> = { front: 'Front', interior: 'Interior', back: 'Rear' };

    // ── Full panel ────────────────────────────────────────────────────────
    if (isOpen) {
        return (
            <div className="absolute right-0 top-0 h-full z-40 shadow-2xl border-l border-zinc-800/80 w-[280px] bg-zinc-950 flex flex-col">
                <LeftZone onClose={close} />
            </div>
        );
    }

    // ── PiP thumbnail ─────────────────────────────────────────────────────
    if (pipVisible) {
        return (
            <>
                <style>{`
                    @keyframes pip-slide-in {
                        from { transform: translateX(calc(100% + 1.25rem)); opacity: 0; }
                        to   { transform: translateX(0); opacity: 1; }
                    }
                `}</style>
                <div
                    className="absolute right-4 top-16 z-50 w-72 rounded-xl overflow-hidden
                               border border-zinc-700/60 bg-zinc-950/95 backdrop-blur-xl
                               shadow-[0_8px_32px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)]"
                    style={{ animation: 'pip-slide-in 0.25s ease-out forwards' }}
                >
                    {/* Header strip */}
                    <div className="flex items-center justify-between gap-1 px-2.5 py-2 bg-zinc-900/80 border-b border-zinc-800/60">
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-zinc-400">
                                {VIEW_LABEL[activeView] ?? activeView}
                            </span>
                            {spatialContext && spatialContext.highlights.length > 0 && (
                                <span className="text-[9px] font-mono text-amber-500/80">
                                    · {spatialContext.highlights.length} part{spatialContext.highlights.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center">
                            {/* Expand to full panel */}
                            <button
                                onClick={() => { setPipVisible(false); open(); }}
                                title="Expand to full view"
                                className="text-zinc-500 hover:text-zinc-200 transition-colors p-2 rounded-md hover:bg-zinc-800/70 min-w-[2rem] min-h-[2rem] flex items-center justify-center"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 3 21 3 21 9" />
                                    <polyline points="9 21 3 21 3 15" />
                                    <line x1="21" y1="3" x2="14" y2="10" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            </button>
                            {/* Dismiss PiP */}
                            <button
                                onClick={() => setPipVisible(false)}
                                title="Dismiss"
                                className="text-zinc-500 hover:text-zinc-200 transition-colors p-2 rounded-md hover:bg-zinc-800/70 min-w-[2rem] min-h-[2rem] flex items-center justify-center"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Machine view — tap to expand */}
                    <div
                        className="cursor-pointer"
                        onClick={() => { setPipVisible(false); open(); }}
                        title="Tap to expand"
                    >
                        <SpatialViewport
                            currentView={activeView}
                            registry={registry}
                            highlightedComponents={spatialContext?.highlights ?? []}
                            drawPath={spatialContext?.draw_path ?? false}
                            isOverlay
                        />
                    </div>

                    {/* Tap hint footer */}
                    <div className="px-2.5 py-1.5 border-t border-zinc-800/60 bg-zinc-900/60">
                        <p className="text-[9px] font-mono text-zinc-600 text-center uppercase tracking-widest select-none">
                            Tap to expand
                        </p>
                    </div>
                </div>
            </>
        );
    }

    // ── FAB — always reachable, opens PiP on tap ──────────────────────────
    return (
        <button
            onClick={() => setPipVisible(true)}
            title="Open machine view"
            className="absolute right-4 bottom-24 z-50 w-12 h-12 rounded-full
                       bg-zinc-900 border border-zinc-700/60 text-zinc-400
                       hover:text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800
                       shadow-lg transition-all flex items-center justify-center"
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
            </svg>
        </button>
    );
}

// ── Main app ───────────────────────────────────────────────────────────────
export function App() {
    return (
        <WorkbenchProvider>
            <BrowserRouter>
                <style>{`html, body, #root { height: 100%; margin: 0; padding: 0; }`}</style>
                <div
                    className="relative flex h-full w-full overflow-hidden"
                    style={{ backgroundColor: '#09090b' }}
                >
                    <MachineOverlay />
                    <main
                        className="flex-1 min-w-0 h-full overflow-hidden"
                        style={{ backgroundColor: '#ffffff' }}
                    >
                        <Routes>
                            <Route path="/" element={<IgnisApp />} />
                            <Route path="/components" element={<ComponentsPage />} />
                            <Route path="/components/:name" element={<ComponentPage />} />
                            <Route path="/components/:name/preview/:previewIdx" element={<ComponentPreviewPage />} />
                        </Routes>
                    </main>
                </div>
            </BrowserRouter>
        </WorkbenchProvider>
    );
}

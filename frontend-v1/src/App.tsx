import { Wrench, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import React, { useCallback, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ComponentPage } from './components/ComponentPage';
import { ComponentPreviewPage } from './components/ComponentPreviewPage';
import { ComponentsPage } from './components/ComponentsPage';
import { GlobalMachineViewer } from './components/GlobalMachineViewer';
import { IgnisApp } from './components/IgnisApp';
import { WorkbenchProvider, useWorkbench } from './components/WorkbenchOverlay';
const MIN_LEFT_PCT = 25;
const MAX_LEFT_PCT = 72;
const DEFAULT_LEFT_PCT = 42;

function SplitPaneLayout() {
    const { isOpen: isRightOpen, toggleOpen: toggleRight } = useWorkbench(
        useShallow((s) => ({
            isOpen: s.isOpen,
            toggleOpen: s.toggleOpen,
        }))
    );
    const [leftPct, setLeftPct] = useState(DEFAULT_LEFT_PCT);
    const [isDraggingDivider, setIsDraggingDivider] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDividerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingDivider(true);
        e.currentTarget.setPointerCapture(e.pointerId);
    }, []);

    const handleDividerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const raw = ((e.clientX - rect.left) / rect.width) * 100;
        setLeftPct(Math.max(MIN_LEFT_PCT, Math.min(MAX_LEFT_PCT, raw)));
    }, []);

    const handleDividerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        setIsDraggingDivider(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    }, []);

    return (
        <div
            ref={containerRef}
            className="flex h-full w-full overflow-hidden"
            style={{ backgroundColor: '#0f1114' }}
        >
            {/* ── Left pane — chat ──────────────────────────────────────── */}
            <div
                className="h-full overflow-hidden flex-shrink-0 relative"
                style={{
                    width: isRightOpen ? `${leftPct}%` : '100%',
                    transition: isDraggingDivider ? 'none' : 'width 0.35s cubic-bezier(0.4,0,0.2,1)',
                }}
            >
                <IgnisApp onToggleWorkbench={toggleRight} workbenchOpen={isRightOpen} />
                <div id="floating-viewport-root" className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center" />
            </div>

            {/* ── Draggable 1px divider ─────────────────────────────────── */}
            {isRightOpen && (
                <div
                    className="relative flex-shrink-0 h-full group z-10"
                    style={{ width: 9, cursor: 'col-resize' }}
                    onPointerDown={handleDividerPointerDown}
                    onPointerMove={handleDividerPointerMove}
                    onPointerUp={handleDividerPointerUp}
                >
                    {/* 1px visible line */}
                    <div
                        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-150"
                        style={{
                            backgroundColor: isDraggingDivider
                                ? 'rgba(255,107,0,0.65)'
                                : 'rgba(255,255,255,0.08)',
                        }}
                    />
                    {/* Drag handle pill — appears on hover/drag */}
                    <div
                        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-150 ${isDraggingDivider ? 'opacity-100 w-1.5 h-12' : 'opacity-0 group-hover:opacity-100 w-1 h-10'
                            }`}
                        style={{
                            backgroundColor: isDraggingDivider
                                ? 'rgba(255,107,0,0.85)'
                                : 'rgba(255,255,255,0.3)',
                        }}
                    />
                </div>
            )}

            {/* ── Right pane — Global Machine Viewer ───────────────────── */}
            {isRightOpen && (
                <div className="flex-1 h-full overflow-hidden min-w-0">
                    <GlobalMachineViewer />
                </div>
            )}

            {/* ── Floating spanner FAB — toggles machine viewer ─────────── */}
            <button
                onClick={toggleRight}
                title={isRightOpen ? 'Close machine viewer' : 'Open machine viewer'}
                aria-label={isRightOpen ? 'Close machine viewer' : 'Open machine viewer'}
                className="fixed bottom-20 right-6 z-50 w-14 h-14 rounded-full 
               flex items-center justify-center text-white
               transition-all duration-300 hover:scale-110 active:scale-95
               shadow-xl border border-white/10 overflow-hidden"
                style={{
                    backgroundColor: isRightOpen ? '#c44e00' : '#ff6b00',
                    boxShadow: isRightOpen
                        ? '0 8px 32px rgba(196, 78, 0, 0.6)'
                        : '0 4px 24px rgba(255, 107, 0, 0.45)',
                }}
            >
                <div className="relative w-6 h-6">
                    <Wrench
                        className={`absolute inset-0 w-6 h-6 transition-all duration-400 ease-out
                   ${isRightOpen
                                ? 'opacity-0 rotate-90 scale-50'
                                : 'opacity-100 rotate-0 scale-100'}`}
                        strokeWidth={2.5}
                    />
                    <X
                        className={`absolute inset-0 w-6 h-6 transition-all duration-400 ease-out
                   ${isRightOpen
                                ? 'opacity-100 rotate-0 scale-100'
                                : 'opacity-0 -rotate-45 scale-75'}`}
                        strokeWidth={3.25}
                    />
                </div>
            </button>
        </div>
    );
}

export function App() {
    return (
        <WorkbenchProvider>
            <BrowserRouter>
                <style>{`html, body, #root { height: 100%; margin: 0; padding: 0; }`}</style>
                <div
                    className="flex h-full w-full overflow-hidden"
                    style={{ backgroundColor: '#0f1114' }}
                >
                    <Routes>
                        <Route path="/" element={<SplitPaneLayout />} />
                        <Route path="/components" element={<ComponentsPage />} />
                        <Route path="/components/:name" element={<ComponentPage />} />
                        <Route path="/components/:name/preview/:previewIdx" element={<ComponentPreviewPage />} />
                    </Routes>
                </div>
            </BrowserRouter>
        </WorkbenchProvider>
    );
}

// frontend/src/App.tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ComponentPage } from './components/ComponentPage';
import { ComponentPreviewPage } from './components/ComponentPreviewPage';
import { ComponentsPage } from './components/ComponentsPage';
import { IgnisApp } from './components/IgnisApp';
import { WorkbenchProvider, useWorkbench } from './components/WorkbenchOverlay';
import { LeftZone } from './components/LeftZone';
import { FloatingSpannerFab } from './components/FloatingSpannerFab';

// ── Workbench side panel — slides in from the right when FAB is clicked ────
function MachineOverlay() {
    const { isOpen, close } = useWorkbench();
    if (!isOpen) return null;
    return (
        <div className="absolute right-0 top-0 h-full z-40 shadow-2xl w-[280px] flex flex-col animate-slide-down"
             style={{ borderLeft: '1px solid #2a2f3b', backgroundColor: '#0f1114' }}>
            <LeftZone onClose={close} />
        </div>
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
                    style={{ backgroundColor: '#0f1114' }}
                >
                    <MachineOverlay />
                    <main
                        className="flex-1 min-w-0 h-full overflow-hidden"
                        style={{ backgroundColor: '#0f1114' }}
                    >
                        <Routes>
                            <Route path="/" element={<IgnisApp />} />
                            <Route path="/components" element={<ComponentsPage />} />
                            <Route path="/components/:name" element={<ComponentPage />} />
                            <Route path="/components/:name/preview/:previewIdx" element={<ComponentPreviewPage />} />
                        </Routes>
                    </main>
                    {/* Floating wrench FAB — opens / closes the workbench panel */}
                    <FloatingSpannerFab />
                </div>
            </BrowserRouter>
        </WorkbenchProvider>
    );
}

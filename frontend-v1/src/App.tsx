// frontend/src/App.tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ComponentPage } from './components/ComponentPage';
import { ComponentPreviewPage } from './components/ComponentPreviewPage';
import { ComponentsPage } from './components/ComponentsPage';
import { IgnisApp } from './components/IgnisApp';
import { WorkbenchProvider, useWorkbench } from './components/WorkbenchOverlay';
import { LeftZone } from './components/LeftZone';

// ── Workbench side panel — shown only when explicitly opened via header cog ─
function MachineOverlay() {
    const { isOpen, close } = useWorkbench();
    if (!isOpen) return null;
    return (
        <div className="absolute right-0 top-0 h-full z-40 shadow-2xl border-l border-zinc-800/80 w-[280px] bg-zinc-950 flex flex-col">
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

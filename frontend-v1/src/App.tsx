// frontend/src/App.tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ComponentPage } from './components/ComponentPage';
import { ComponentPreviewPage } from './components/ComponentPreviewPage';
import { ComponentsPage } from './components/ComponentsPage';
import { IgnisApp } from './components/IgnisApp';
import { WorkbenchOverlay, WorkbenchProvider } from './components/WorkbenchOverlay';

// ── Main app ───────────────────────────────────────────────────────────────
export function App() {
    return (
        <WorkbenchProvider>
        <BrowserRouter>
            <style>{`html, body, #root { height: 100%; margin: 0; padding: 0; }`}</style>

            <main style={{ height: '100%', overflowY: 'auto', backgroundColor: '#ffffff' }}>
                <Routes>
                    <Route path="/" element={<IgnisApp />} />
                    <Route path="/components" element={<ComponentsPage />} />
                    <Route path="/components/:name" element={<ComponentPage />} />
                    <Route path="/components/:name/preview/:previewIdx" element={<ComponentPreviewPage />} />
                </Routes>
            </main>

            {/* ── Garage Workbench overlay (floating, left-anchored) ───────── */}
            <WorkbenchOverlay />
        </BrowserRouter>
        </WorkbenchProvider>
    );
}

// frontend/src/components/WorkbenchOverlay.tsx
//
// Context provider for the Garage Workbench.
// Exports:
//   WorkbenchProvider  – wraps the app; manages workbench state
//   useWorkbench       – hook to read/drive the workbench from anywhere
//
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import type { ChatArtifact } from './ChatPane';
import type { SpatialContextTag } from '../lib/artifacts';
import type { SessionState } from '../lib/chatApi';
import type { DebugTurn } from './DebugPanel';
import {
    MachineView,
    REGISTRY_BY_VIEW,
    SpatialControlPoint,
    WelderTelemetry,
} from './SpatialViewport';

// ── Re-export so consumers can import from one place ──────────────────────────
export type { WelderTelemetry };

// ── Registry export formatter (used by LeftZone modify mode) ──────────────────
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

// ── Context ────────────────────────────────────────────────────────────────────
interface WorkbenchCtx {
    // ── existing ───────────────────────────────────────────────────────────────
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

    // ── new ────────────────────────────────────────────────────────────────────
    spatialContext:       SpatialContextTag | null;
    setSpatialContext:    (ctx: SpatialContextTag | null) => void;
    /** Active machine view in the workbench — shared so the toggle drives context state */
    activeView:           MachineView;
    setActiveView:        (v: MachineView) => void;
    pinnedArtifacts:      ChatArtifact[];
    addPinnedArtifact:    (a: ChatArtifact) => void;
    removePinnedArtifact: (id: string) => void;
    sessionState:         SessionState;
    setSessionState:      (s: SessionState) => void;
    turns:                DebugTurn[];
    addTurn:              (t: DebugTurn) => void;
    /** Send a user message into the chat stream (registered by IgnisApp). */
    sendMessage:          (text: string) => void;
    /** Called once by IgnisApp to bind its sendMessage fn into context. */
    registerSendMessage:  (fn: (text: string) => void) => void;
    /** Appends a local assistant confirmation without starting a new agent turn. */
    appendAssistantConfirmation:         (text: string) => void;
    registerAssistantConfirmationWriter: (fn: (text: string) => void) => void;
    /** The currently active diagnostic checklist (set by IgnisApp on message finalize). */
    activeChecklist:      ChatArtifact | null;
    setActiveChecklist:   (a: ChatArtifact | null) => void;
    /** Session ID registered once by IgnisApp; consumed by ChecklistRenderer for telemetry. */
    sessionId:            string;
    registerSessionId:    (id: string) => void;
    /** The artifact currently displayed as the primary workbench canvas (non-checklist). */
    activeArtifact:       ChatArtifact | null;
    setActiveArtifact:    (a: ChatArtifact | null) => void;
}

const WorkbenchContext = createContext<WorkbenchCtx | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────
export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
    const [isOpen,    setIsOpen]    = useState(true);
    const [isPinned,  setIsPinned]  = useState(false);
    const [telemetry, setTelemetry] = useState<WelderTelemetry | undefined>();
    const [artifacts, setArtifacts] = useState<ChatArtifact[]>([]);

    const [spatialContext,  setSpatialContext]  = useState<SpatialContextTag | null>(null);
    const [activeView,      setActiveView]      = useState<MachineView>('front');

    // Auto-sync workbench view when the agent emits a spatial tag
    useEffect(() => {
        if (spatialContext?.view) setActiveView(spatialContext.view);
    }, [spatialContext]);
    const [pinnedArtifacts, setPinnedArtifacts] = useState<ChatArtifact[]>([]);
    const [sessionState,    setSessionState]    = useState<SessionState>({
        process: null, voltage: null, material: null, thickness: null, wire_size: null,
    });
    const [turns, setTurns] = useState<DebugTurn[]>([]);
    const [activeChecklist,  setActiveChecklistRaw]  = useState<ChatArtifact | null>(null);
    const [activeArtifact,   setActiveArtifactState] = useState<ChatArtifact | null>(null);
    const sessionIdRef = useRef<string>('');

    const open       = useCallback(() => setIsOpen(true),      []);
    const close      = useCallback(() => setIsOpen(false),     []);
    const toggleOpen = useCallback(() => setIsOpen(v => !v),   []);
    const togglePin  = useCallback(() => setIsPinned(v => !v), []);

    const addPinnedArtifact = useCallback((a: ChatArtifact) => {
        setPinnedArtifacts(prev => {
            const idx = prev.findIndex(p => p.id === a.id);
            if (idx >= 0) return prev.map((p, i) => i === idx ? a : p);
            return [...prev, a];
        });
    }, []);
    const removePinnedArtifact = useCallback((id: string) => {
        setPinnedArtifacts(prev => prev.filter(p => p.id !== id));
    }, []);
    const addTurn = useCallback((t: DebugTurn) => {
        setTurns(prev => [...prev, t]);
    }, []);

    // sendMessage is registered once by IgnisApp; stored in a ref so callers
    // (e.g. ChecklistRenderer) can fire it without re-render overhead.
    const sendMessageRef = useRef<((text: string) => void) | null>(null);
    const assistantConfirmationRef = useRef<((text: string) => void) | null>(null);
    const registerSendMessage = useCallback((fn: (text: string) => void) => {
        sendMessageRef.current = fn;
    }, []);
    const sendMessage = useCallback((text: string) => {
        sendMessageRef.current?.(text);
    }, []);
    const registerAssistantConfirmationWriter = useCallback((fn: (text: string) => void) => {
        assistantConfirmationRef.current = fn;
    }, []);
    const appendAssistantConfirmation = useCallback((text: string) => {
        assistantConfirmationRef.current?.(text);
    }, []);

    const setActiveChecklist = useCallback((a: ChatArtifact | null) => {
        setActiveChecklistRaw(a);
    }, []);
    const setActiveArtifact = useCallback((a: ChatArtifact | null) => {
        setActiveArtifactState(a);
    }, []);
    const registerSessionId = useCallback((id: string) => {
        sessionIdRef.current = id;
    }, []);

    // ── ignis:updateWorkbench back-channel ─────────────────────────────────────
    // Artifact iframes can post this message to update session state directly.
    // Shape: { type: 'ignis:updateWorkbench', payload: Partial<SessionState> }
    useEffect(() => {
        const ALLOWED_KEYS: (keyof SessionState)[] = ['process', 'voltage', 'material', 'thickness', 'wire_size'];
        const handler = (e: MessageEvent) => {
            if (!e.data || e.data.type !== 'ignis:updateWorkbench') return;
            const payload = e.data.payload;
            if (!payload || typeof payload !== 'object') return;
            setSessionState(prev => {
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
    }, []);

    return (
        <WorkbenchContext.Provider
            value={{
                isOpen, isPinned, telemetry, artifacts,
                open, close, toggleOpen, togglePin, setTelemetry, setArtifacts,
                spatialContext, setSpatialContext,
                activeView, setActiveView,
                pinnedArtifacts, addPinnedArtifact, removePinnedArtifact,
                sessionState, setSessionState,
                turns, addTurn,
                sendMessage, registerSendMessage,
                appendAssistantConfirmation, registerAssistantConfirmationWriter,
                activeChecklist, setActiveChecklist,
                sessionId: sessionIdRef.current, registerSessionId,
                activeArtifact, setActiveArtifact,
            }}
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

// ── Inline mini export panel (used by LeftZone modify mode) ───────────────────
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

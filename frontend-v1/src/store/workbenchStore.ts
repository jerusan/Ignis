import { create } from 'zustand';
import type {
  SpatialContextTag,
  SessionState,
  ChatArtifact,
  DebugTurn,
  MachineView,
  WelderTelemetry,
  ChatMessage,
} from '../types/chat';

export interface WorkbenchState {
  // ── UI Visibility ──
  isOpen: boolean;
  isPinned: boolean;
  activeView: MachineView;
  viewportIsFloating: boolean;
  
  // ── Session & Telemetry ──
  telemetry: WelderTelemetry | undefined;
  sessionState: SessionState;
  turns: DebugTurn[];
  sessionId: string;

  // ── Artifacts & Checklist ──
  artifacts: ChatArtifact[];
  pinnedArtifacts: ChatArtifact[];
  activeChecklist: ChatArtifact | null;
  activeArtifact: ChatArtifact | null;
  spatialContext: SpatialContextTag | null;

  // ── Chat State ──
  messages: ChatMessage[];
  isStreaming: boolean;
  offline: boolean;

  // ── Callback Registries (for ref-based actions) ──
  sendMessageFn: ((text: string) => void) | null;
  assistantConfirmationFn: ((text: string) => void) | null;

  // ── Actions ──
  open: () => void;
  close: () => void;
  toggleOpen: () => void;
  togglePin: () => void;
  setViewportIsFloating: (floating: boolean) => void;
  setActiveView: (v: MachineView) => void;
  setTelemetry: (t: WelderTelemetry | undefined) => void;
  setSessionState: (updater: SessionState | ((prev: SessionState) => SessionState)) => void;
  addTurn: (t: DebugTurn) => void;
  setArtifacts: (a: ChatArtifact[]) => void;
  addPinnedArtifact: (a: ChatArtifact) => void;
  removePinnedArtifact: (id: string) => void;
  setActiveChecklist: (a: ChatArtifact | null) => void;
  setActiveArtifact: (a: ChatArtifact | null) => void;
  setSpatialContext: (ctx: SpatialContextTag | null) => void;

  // ── Chat Actions ──
  setMessages: (updater: ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[])) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setOffline: (offline: boolean) => void;

  // ── Callbacks Bindings ──
  sendMessage: (text: string) => void;
  registerSendMessage: (fn: (text: string) => void) => void;
  appendAssistantConfirmation: (text: string) => void;
  registerAssistantConfirmationWriter: (fn: (text: string) => void) => void;
  registerSessionId: (id: string) => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  // ── Initial State ──
  isOpen: false,
  isPinned: false,
  activeView: 'front',
  viewportIsFloating: false,
  telemetry: undefined,
  sessionState: {
    process: null,
    voltage: null,
    material: null,
    thickness: null,
    wire_size: null,
  },
  turns: [],
  sessionId: '',
  artifacts: [],
  pinnedArtifacts: [],
  activeChecklist: null,
  activeArtifact: null,
  spatialContext: null,
  messages: [],
  isStreaming: false,
  offline: false,
  sendMessageFn: null,
  assistantConfirmationFn: null,

  // ── State Mutators ──
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, spatialContext: null }),
  toggleOpen: () => set((state) => {
    // If closing, clear spatial context after turn/defer
    const nextOpen = !state.isOpen;
    return {
      isOpen: nextOpen,
      spatialContext: nextOpen ? state.spatialContext : null,
    };
  }),
  togglePin: () => set((state) => ({ isPinned: !state.isPinned })),
  setViewportIsFloating: (viewportIsFloating) => set({ viewportIsFloating }),
  setActiveView: (activeView) => set({ activeView }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setSessionState: (updater) => set((state) => ({
    sessionState: typeof updater === 'function' ? updater(state.sessionState) : updater,
  })),
  addTurn: (turn) => set((state) => ({ turns: [...state.turns, turn] })),
  setArtifacts: (artifacts) => set({ artifacts }),
  addPinnedArtifact: (artifact) => set((state) => {
    const idx = state.pinnedArtifacts.findIndex((p) => p.id === artifact.id);
    if (idx >= 0) {
      return {
        pinnedArtifacts: state.pinnedArtifacts.map((p, i) => (i === idx ? artifact : p)),
      };
    }
    return { pinnedArtifacts: [...state.pinnedArtifacts, artifact] };
  }),
  removePinnedArtifact: (id) => set((state) => ({
    pinnedArtifacts: state.pinnedArtifacts.filter((p) => p.id !== id),
  })),
  setActiveChecklist: (activeChecklist) => set({ activeChecklist }),
  setActiveArtifact: (activeArtifact) => set({ activeArtifact }),
  setSpatialContext: (spatialContext) => set((state) => {
    // Auto-sync workbench view and open the pane when the agent emits a spatial tag
    if (spatialContext) {
      const updates: Partial<WorkbenchState> = {
        spatialContext,
        isOpen: true,
      };
      if (spatialContext.view) {
        updates.activeView = spatialContext.view;
      }
      return updates;
    }
    return { spatialContext };
  }),

  // ── Chat Mutators ──
  setMessages: (updater) => set((state) => ({
    messages: typeof updater === 'function' ? updater(state.messages) : updater,
  })),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setOffline: (offline) => set({ offline }),

  // ── Callback Bindings ──
  registerSendMessage: (fn) => set({ sendMessageFn: fn }),
  sendMessage: (text) => {
    const { sendMessageFn } = get();
    if (sendMessageFn) {
      sendMessageFn(text);
    }
  },
  registerAssistantConfirmationWriter: (fn) => set({ assistantConfirmationFn: fn }),
  appendAssistantConfirmation: (text) => {
    const { assistantConfirmationFn } = get();
    if (assistantConfirmationFn) {
      assistantConfirmationFn(text);
    }
  },
  registerSessionId: (sessionId) => set({ sessionId }),
}));

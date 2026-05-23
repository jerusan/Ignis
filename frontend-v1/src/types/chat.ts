import type React from 'react';

// --- Voice types ---
export type VoiceState = 'idle' | 'recording' | 'processing' | 'disabled';

// --- Artifact types ---
export type ArtifactType = 'react' | 'svg' | 'html' | 'checklist' | 'mermaid' | 'markdown' | 'widget';

export interface ChatArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  code: string;
  mode?: 'replace';
  source_pages?: string;
  widgetName?: string;
}

// --- Tool types ---
export type ToolName =
  | 'get_machine_spec'
  | 'diagnose_defect'
  | 'get_visual'
  | 'search_manual'
  | string;

export type ToolStatus = 'running' | 'done' | 'error';

export interface ChatToolCall {
  id: string;
  tool: ToolName;
  status: ToolStatus;
  input?: Record<string, unknown>;
  result?: string;
}

// --- Spatial types ---
export type MachineView = 'front' | 'interior' | 'back';

export interface SpatialControlPoint {
  x: number;      // Normalized 0–1000 coordinate space
  y: number;
  radius: number;
  title: string;
  desc: string;
}

export interface WelderTelemetry {
  amperage?: number;   // A
  voltage?: number;    // V
  wfs?: number;        // wire feed speed m/min
}

export interface SpatialContextTag {
  view: MachineView;
  highlights: string[];
  draw_path?: boolean;
}

export interface PendingArtifact {
  type?: string;
  title?: string;
}

// --- Reference image types ---
export interface HighlightBounds {
  x: number;      // 0–100 percentage of rendered image width
  y: number;      // 0–100 percentage of rendered image height
  width: number;
  height: number;
  label?: string;
}

export interface ReferenceImage {
  alt: string;
  url: string;
  bounds?: HighlightBounds;
}

// --- Checklist types ---
export interface ChecklistStep {
  id: string;
  text: string;
  detail?: string;
  spatial?: {
    view: MachineView;
    highlights: string[];
    draw_path?: boolean;
  };
}

// --- Chat types ---
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  toolCalls?: ChatToolCall[];
  artifacts?: ChatArtifact[];
  timestamp?: string;
  spatialContext?: SpatialContextTag | null;
}

export interface ChatPaneProps {
  messages: ChatMessage[];
  onSend?: (text: string) => void;
  voiceState?: VoiceState;
  onVoiceToggle?: () => void;
  offline?: boolean;
  placeholder?: string;
  disabled?: boolean;
  emptyState?: React.ReactNode;
  onWorkbenchToggle?: () => void;
  workbenchOpen?: boolean;
}

// --- API types ---
export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SessionState {
  process: string | null;
  voltage: string | null;
  material: string | null;
  thickness: string | null;
  wire_size: string | null;
}

export type ChatStreamEvent =
  | {
      type: 'text_delta';
      text: string;
    }
  | {
      type: 'tool_use';
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: 'tool_result';
      tool: string;
      content: unknown;
    }
  | {
      type: 'done';
      input_tokens: number;
      output_tokens: number;
      session_context?: SessionState;
    };

export interface ChatRequest {
  messages: ApiMessage[];
  sessionId: string;
}

// --- Debug types ---
export interface DebugTurn {
  id: string;
  label?: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  toolsCalled: string[];
}

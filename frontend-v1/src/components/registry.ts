// AUTO-GENERATED — do not edit manually.
// Re-run the design system builder to regenerate.

import type { ComponentPreviewModule } from './previewTypes';
import __ArtifactRendererPreviews from './ArtifactRenderer/ArtifactRenderer.previews';
import __ChatPanePreviews from './ChatPane/ChatPane.previews';
import __DebugPanelPreviews from './DebugPanel/DebugPanel.previews';
import __IgnisAppPreviews from './IgnisApp/IgnisApp.previews';
import __MessagePreviews from './Message/Message.previews';
import __ToolCallChipPreviews from './ToolCallChip/ToolCallChip.previews';
import __VoiceButtonPreviews from './VoiceButton/VoiceButton.previews';
const __contextMd: Record<string, string> = {
  "ArtifactRenderer": `
# ArtifactRenderer

Renders an \`<artifact>\` returned by the Ignis agent inside a sandboxed iframe. Supports three types:

- \`react\` — runs through Babel standalone, expects a top-level \`App\` component
- \`svg\` — renders raw SVG markup centered on a white canvas
- \`html\` — used directly as the iframe \`srcdoc\`

The iframe uses \`sandbox="allow-scripts"\` only — no same-origin, no parent access — so a broken artifact can never crash the chat shell. Runtime errors are caught and displayed in an inline red panel; the rest of the conversation keeps working.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`type\` | \`'react' \\| 'svg' \\| 'html'\` | required | How to interpret \`code\` |
| \`title\` | \`string\` | required | Title shown in the header strip |
| \`code\` | \`string\` | required | Source of the artifact |
| \`height\` | \`number \\| string\` | \`360\` | Iframe height in px (or any CSS length) |
| \`defaultView\` | \`'preview' \\| 'code'\` | \`'preview'\` | Initial pane |

## Usage

\`\`\`tsx
<ArtifactRenderer
  type="react"
  title="Duty Cycle Calculator"
  code={artifactCode}
/>
\`\`\`

The header includes a Preview / Code toggle and a re-render button that re-mounts the iframe — useful when iterating on streaming artifacts.
`,
  "ChatPane": `
# ChatPane

Top-level chat surface for Ignis. Composes \`Message\`, \`ToolCallChip\`, \`ArtifactRenderer\`, and \`VoiceButton\` into the conversational shell. Handles its own scroll-to-bottom, input state, and Enter-to-send behavior; the SSE stream and message-state management live in the parent.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`messages\` | \`ChatMessage[]\` | required | Ordered conversation log |
| \`onSend\` | \`(text: string) => void\` | — | Called on submit |
| \`voiceState\` | \`VoiceState\` | \`'idle'\` | State for the inline mic button |
| \`onVoiceToggle\` | \`() => void\` | — | Pass to enable the mic button |
| \`offline\` | \`boolean\` | \`false\` | Shows the offline banner |
| \`placeholder\` | \`string\` | \`"Ask about your Vulcan OmniPro 220…"\` | Input placeholder |
| \`disabled\` | \`boolean\` | \`false\` | Disables input + send |
| \`emptyState\` | \`ReactNode\` | default panel | Override the welcome panel |

### \`ChatMessage\`

\`\`\`ts
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  streaming?: boolean
  toolCalls?: ChatToolCall[]
  artifacts?: ChatArtifact[]
  timestamp?: string
}
\`\`\`

## Usage

\`\`\`tsx
<ChatPane
  messages={messages}
  onSend={sendMessage}
  voiceState={voice}
  onVoiceToggle={toggleVoice}
  offline={!navigator.onLine}
/>
\`\`\`

The parent owns SSE handling: append a \`text_delta\` to the current assistant message's \`text\`, set \`streaming: true\` until the \`done\` event, and add \`toolCalls\` / \`artifacts\` as they arrive.
`,
  "DebugPanel": `
# DebugPanel

Collapsible diagnostics strip for the Ignis chat shell. Surfaces per-turn cost, latency, token usage, and tool calls so judges can see the agent is cost-aware without cluttering the conversation.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`turns\` | \`DebugTurn[]\` | required | One entry per agent turn |
| \`defaultOpen\` | \`boolean\` | \`false\` | Whether the panel starts expanded |

### \`DebugTurn\`

\`\`\`ts
interface DebugTurn {
  id: string             // e.g. "turn_01"
  label?: string         // human-readable summary, e.g. user question
  latencyMs: number      // start → done in milliseconds
  inputTokens: number
  outputTokens: number
  costUsd: number        // computed at Sonnet pricing
  toolsCalled: string[]  // names in call order
}
\`\`\`

## Usage

\`\`\`tsx
<DebugPanel turns={turns} />
\`\`\`

The collapsed header shows aggregate cost and latency across all turns. Expanding reveals one row per turn with a small stat grid plus the tool-call chips for that turn.
`,
  "IgnisApp": `

# IgnisApp

The cohesive single-page Ignis experience. Composes every other design-system component into a working demo of the Vulcan OmniPro 220 assistant.

## What's included

- **Header** — Ignis logo + title, plus a live aggregate strip (turns, cost, tokens) that mirrors what's in \`DebugPanel\`.
- **ChatPane** — Empty state with three suggested prompts; user input with Enter-to-send; assistant responses that **stream** text chunk-by-chunk, surface running → done tool calls, and attach artifacts when the response completes.
- **VoiceButton** — Wired into the chat input. Demo cycles \`idle → recording → processing → idle\` and auto-sends a polarity question to showcase the flow.
- **ArtifactRenderer** — Two artifact paths are demonstrated: a React duty-cycle calculator (sandboxed iframe + Babel) and an SVG polarity wiring diagram.
- **DebugPanel** — Docked footer; one row per turn with latency, tokens, cost, and tool-call chips.
- **Offline detection** — Listens to \`online\`/\`offline\` events and shows the warning banner inside \`ChatPane\`.

## Canned demo turns

Three intent matchers drive the mock SSE responses:

| Match | Tools | Artifact |
|-------|-------|----------|
| \`duty cycle\` | \`get_machine_spec\` | React duty-cycle calculator |
| \`polarity\` / \`tig\` / \`aluminum\` | \`search_manual\`, \`get_visual\` | SVG polarity diagram |
| \`porosity\` / \`holes\` / \`gas\` | \`diagnose_defect\` ×2 | — |

Anything else falls back to a general capabilities response.

## Usage

\`\`\`tsx
import IgnisApp from 'components/IgnisApp'

export function App() {
  return <IgnisApp />
}
\`\`\`

\`IgnisApp\` is self-contained — it owns its own message state, debug-turn log, and voice lifecycle — so it can be dropped into any shell as a full-page component.

`,
  "Message": `
# Message

Chat message bubble for the Ignis assistant. Supports user and assistant roles, an optional streaming cursor, and a timestamp.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`role\` | \`'user' \\| 'assistant'\` | required | Determines color, alignment, and avatar |
| \`children\` | \`ReactNode\` | required | Message body (text, markdown, artifacts) |
| \`streaming\` | \`boolean\` | \`false\` | Shows a pulsing cursor for in-flight SSE responses |
| \`timestamp\` | \`string\` | — | Display string shown below the bubble |

## Usage

\`\`\`tsx
<Message role="user" timestamp="2:14 PM">
  What polarity for flux-cored?
</Message>

<Message role="assistant" streaming>
  Looking up the chart
</Message>
\`\`\`

User messages right-align with the primary color; assistant messages left-align on \`background-muted\`. Avatars use Lucide icons (\`UserIcon\` / \`SparklesIcon\`).
`,
  "ToolCallChip": `
# ToolCallChip

Inline indicator chip for an agent tool call. Renders the tool's friendly label, a status icon, and an optional expandable panel showing JSON input + result. Designed to sit inside the assistant's message stream so the user can see what the agent is doing in real time.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`tool\` | \`string\` | required | Tool name. Known: \`get_machine_spec\`, \`diagnose_defect\`, \`get_visual\`, \`search_manual\` |
| \`status\` | \`'running' \\| 'done' \\| 'error'\` | \`'done'\` | Drives the status icon |
| \`input\` | \`Record<string, unknown>\` | — | Tool input args, shown as JSON when expanded |
| \`result\` | \`string\` | — | Tool result text, shown when expanded |
| \`defaultOpen\` | \`boolean\` | \`false\` | Whether details start expanded |

## Usage

\`\`\`tsx
<ToolCallChip tool="get_machine_spec" status="running" />

<ToolCallChip
  tool="diagnose_defect"
  input={{ defect: 'porosity', process: 'mig' }}
  result="Next: Is gas flow set to 20–25 CFH?"
/>
\`\`\`

Unknown tool names fall back to a generic wrench icon and use the raw name as the label.
`,
  "VoiceButton": `
# VoiceButton

Round mic button that drives the Deepgram Nova-3 voice input flow.

## States

| State | Color | Icon | Behavior |
|-------|-------|------|----------|
| \`idle\` | primary | \`MicIcon\` | Tap to begin recording |
| \`recording\` | error | \`MicIcon\` | Pulsing ring; tap to stop |
| \`processing\` | info | spinner | Awaiting final transcript |
| \`disabled\` | muted | \`MicOffIcon\` | Non-interactive (no mic permission, missing API key) |

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`state\` | \`VoiceState\` | \`'idle'\` | Controlled visual state |
| \`onClick\` | \`() => void\` | — | Toggle handler |
| \`label\` | \`string\` | derived | Override the \`aria-label\` |
| \`size\` | \`'sm' \\| 'md' \\| 'lg'\` | \`'md'\` | Button size |

## Usage

\`\`\`tsx
<VoiceButton
  state={recording ? 'recording' : 'idle'}
  onClick={() => setRecording((r) => !r)}
/>
\`\`\`

Use a controlled \`state\` driven by the WebSocket lifecycle: \`idle\` → \`recording\` (on open) → \`processing\` (on close) → \`idle\` (after transcript applied).
`
};

export const componentRegistry: ComponentPreviewModule[] = [
__ArtifactRendererPreviews,
__ChatPanePreviews,
__DebugPanelPreviews,
__IgnisAppPreviews,
__MessagePreviews,
__ToolCallChipPreviews,
__VoiceButtonPreviews].

filter((m) => m && m.componentName).
map((m) => ({ ...m, contextMd: __contextMd[m.componentName] ?? m.contextMd })).
sort((a, b) => a.componentName.localeCompare(b.componentName));
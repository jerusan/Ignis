
# ChatPane

Top-level chat surface for Ignis. Composes `Message`, `ToolCallChip`, `ArtifactRenderer`, and `VoiceButton` into the conversational shell. Handles its own scroll-to-bottom, input state, and Enter-to-send behavior; the SSE stream and message-state management live in the parent.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `messages` | `ChatMessage[]` | required | Ordered conversation log |
| `onSend` | `(text: string) => void` | — | Called on submit |
| `voiceState` | `VoiceState` | `'idle'` | State for the inline mic button |
| `onVoiceToggle` | `() => void` | — | Pass to enable the mic button |
| `offline` | `boolean` | `false` | Shows the offline banner |
| `placeholder` | `string` | `"Ask about your Vulcan OmniPro 220…"` | Input placeholder |
| `disabled` | `boolean` | `false` | Disables input + send |
| `emptyState` | `ReactNode` | default panel | Override the welcome panel |

### `ChatMessage`

```ts
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  streaming?: boolean
  toolCalls?: ChatToolCall[]
  artifacts?: ChatArtifact[]
  timestamp?: string
}
```

## Usage

```tsx
<ChatPane
  messages={messages}
  onSend={sendMessage}
  voiceState={voice}
  onVoiceToggle={toggleVoice}
  offline={!navigator.onLine}
/>
```

The parent owns SSE handling: append a `text_delta` to the current assistant message's `text`, set `streaming: true` until the `done` event, and add `toolCalls` / `artifacts` as they arrive.

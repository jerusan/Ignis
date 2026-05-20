
# VoiceButton

Round mic button that drives the Deepgram Nova-3 voice input flow.

## States

| State | Color | Icon | Behavior |
|-------|-------|------|----------|
| `idle` | primary | `MicIcon` | Tap to begin recording |
| `recording` | error | `MicIcon` | Pulsing ring; tap to stop |
| `processing` | info | spinner | Awaiting final transcript |
| `disabled` | muted | `MicOffIcon` | Non-interactive (no mic permission, missing API key) |

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `state` | `VoiceState` | `'idle'` | Controlled visual state |
| `onClick` | `() => void` | — | Toggle handler |
| `label` | `string` | derived | Override the `aria-label` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |

## Usage

```tsx
<VoiceButton
  state={recording ? 'recording' : 'idle'}
  onClick={() => setRecording((r) => !r)}
/>
```

Use a controlled `state` driven by the WebSocket lifecycle: `idle` → `recording` (on open) → `processing` (on close) → `idle` (after transcript applied).

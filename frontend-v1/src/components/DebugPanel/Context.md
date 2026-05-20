
# DebugPanel

Collapsible diagnostics strip for the Ignis chat shell. Surfaces per-turn cost, latency, token usage, and tool calls so judges can see the agent is cost-aware without cluttering the conversation.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `turns` | `DebugTurn[]` | required | One entry per agent turn |
| `defaultOpen` | `boolean` | `false` | Whether the panel starts expanded |

### `DebugTurn`

```ts
interface DebugTurn {
  id: string             // e.g. "turn_01"
  label?: string         // human-readable summary, e.g. user question
  latencyMs: number      // start → done in milliseconds
  inputTokens: number
  outputTokens: number
  costUsd: number        // computed at Sonnet pricing
  toolsCalled: string[]  // names in call order
}
```

## Usage

```tsx
<DebugPanel turns={turns} />
```

The collapsed header shows aggregate cost and latency across all turns. Expanding reveals one row per turn with a small stat grid plus the tool-call chips for that turn.


# Message

Chat message bubble for the Ignis assistant. Supports user and assistant roles, an optional streaming cursor, and a timestamp.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `role` | `'user' \| 'assistant'` | required | Determines color, alignment, and avatar |
| `children` | `ReactNode` | required | Message body (text, markdown, artifacts) |
| `streaming` | `boolean` | `false` | Shows a pulsing cursor for in-flight SSE responses |
| `timestamp` | `string` | — | Display string shown below the bubble |

## Usage

```tsx
<Message role="user" timestamp="2:14 PM">
  What polarity for flux-cored?
</Message>

<Message role="assistant" streaming>
  Looking up the chart
</Message>
```

User messages right-align with the primary color; assistant messages left-align on `background-muted`. Avatars use Lucide icons (`UserIcon` / `SparklesIcon`).


# ToolCallChip

Inline indicator chip for an agent tool call. Renders the tool's friendly label, a status icon, and an optional expandable panel showing JSON input + result. Designed to sit inside the assistant's message stream so the user can see what the agent is doing in real time.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tool` | `string` | required | Tool name. Known: `get_machine_spec`, `diagnose_defect`, `get_visual`, `search_manual` |
| `status` | `'running' \| 'done' \| 'error'` | `'done'` | Drives the status icon |
| `input` | `Record<string, unknown>` | — | Tool input args, shown as JSON when expanded |
| `result` | `string` | — | Tool result text, shown when expanded |
| `defaultOpen` | `boolean` | `false` | Whether details start expanded |

## Usage

```tsx
<ToolCallChip tool="get_machine_spec" status="running" />

<ToolCallChip
  tool="diagnose_defect"
  input={{ defect: 'porosity', process: 'mig' }}
  result="Next: Is gas flow set to 20–25 CFH?"
/>
```

Unknown tool names fall back to a generic wrench icon and use the raw name as the label.

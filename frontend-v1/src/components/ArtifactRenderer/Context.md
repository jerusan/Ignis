
# ArtifactRenderer

Renders an `<artifact>` returned by the Ignis agent inside a sandboxed iframe. Supports three types:

- `react` — runs through Babel standalone, expects a top-level `App` component
- `svg` — renders raw SVG markup centered on a white canvas
- `html` — used directly as the iframe `srcdoc`

The iframe uses `sandbox="allow-scripts"` only — no same-origin, no parent access — so a broken artifact can never crash the chat shell. Runtime errors are caught and displayed in an inline red panel; the rest of the conversation keeps working.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'react' \| 'svg' \| 'html'` | required | How to interpret `code` |
| `title` | `string` | required | Title shown in the header strip |
| `code` | `string` | required | Source of the artifact |
| `height` | `number \| string` | `360` | Iframe height in px (or any CSS length) |
| `defaultView` | `'preview' \| 'code'` | `'preview'` | Initial pane |

## Usage

```tsx
<ArtifactRenderer
  type="react"
  title="Duty Cycle Calculator"
  code={artifactCode}
/>
```

The header includes a Preview / Code toggle and a re-render button that re-mounts the iframe — useful when iterating on streaming artifacts.

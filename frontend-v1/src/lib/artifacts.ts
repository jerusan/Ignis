import type { ArtifactType } from '../components/ArtifactRenderer';
import type { ChatArtifact } from '../components/ChatPane';
import type { MachineView } from '../components/SpatialViewport';

// Re-export so consumers can reference it without importing ArtifactRenderer
export type { ArtifactType };

// ── Checklist step schema (emitted by the agent in checklist artifacts) ────────
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

// Matches <artifact ...>...</artifact> regardless of attribute order.
const ARTIFACT_PATTERN = /<artifact\b([^>]*)>([\s\S]*?)<\/artifact>/g;

const SUPPORTED_TYPES = new Set<ArtifactType>(['react', 'svg', 'html', 'checklist', 'mermaid', 'markdown', 'widget']);

/**
 * Artifact types that belong in the workbench panel (right side), not inline in chat.
 * These render as compact chips in the chat stream and full-size in the workbench canvas.
 */
export const WORKBENCH_ARTIFACT_TYPES = new Set<ArtifactType>(['react', 'svg', 'mermaid', 'html', 'widget']);

function attr(attrString: string, name: string): string | undefined {
  return new RegExp(`${name}="([^"]*)"`, 'i').exec(attrString)?.[1];
}

export function parseArtifacts(text: string): ChatArtifact[] {
  const artifacts: ChatArtifact[] = [];
  ARTIFACT_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ARTIFACT_PATTERN.exec(text)) !== null) {
    const attrs = match[1];
    const type = attr(attrs, 'type') as ArtifactType | undefined;
    if (!type || !SUPPORTED_TYPES.has(type)) continue;

    const agentId = attr(attrs, 'id');
    artifacts.push({
      id: agentId ?? `artifact-${match.index}-${artifacts.length}`,
      type,
      title: attr(attrs, 'title') ?? 'Interactive artifact',
      code: match[2].trim(),
      mode: attr(attrs, 'mode') as 'replace' | undefined,
      source_pages: attr(attrs, 'source_pages'),
      widgetName: attr(attrs, 'name'),
    });
  }

  return artifacts;
}

export function stripArtifacts(text: string): string {
  return text.replace(ARTIFACT_PATTERN, '').trim();
}

// ── Streaming tag suppression ──────────────────────────────────────────────────

export interface PendingArtifact {
  type?: string;
  title?: string;
}

/**
 * During streaming, the model may emit an opening <artifact> or <spatial> tag
 * before the closing tag arrives. This function detects that and returns the
 * safe-to-display prefix plus metadata about what's being built, so the UI can
 * show a building animation instead of raw XML.
 *
 * Call this BEFORE stripArtifacts / stripSpatialContext — those only handle
 * complete tags; this handles the in-flight partial one.
 */
export function stripStreamingTags(text: string): {
  clean: string;
  pending: PendingArtifact | null;
} {
  // Incomplete artifact tag: <artifact ... > ... (no </artifact> yet)
  const artifactOpen = text.lastIndexOf('<artifact');
  if (artifactOpen !== -1) {
    const afterOpen = text.slice(artifactOpen);
    if (!afterOpen.includes('</artifact>')) {
      const typeMatch = /type="([^"]*)"/.exec(afterOpen);
      const titleMatch = /title="([^"]*)"/.exec(afterOpen);
      return {
        clean: text.slice(0, artifactOpen).trim(),
        pending: { type: typeMatch?.[1], title: titleMatch?.[1] },
      };
    }
  }

  // Incomplete spatial tag: <spatial ... (no /> yet)
  const spatialOpen = text.lastIndexOf('<spatial');
  if (spatialOpen !== -1) {
    const afterOpen = text.slice(spatialOpen);
    if (!afterOpen.includes('/>') && !afterOpen.includes('</spatial>')) {
      return {
        clean: text.slice(0, spatialOpen).trim(),
        pending: { type: 'spatial' },
      };
    }
  }

  return { clean: text, pending: null };
}

// ── Spatial context ────────────────────────────────────────────────────────────

export interface SpatialContextTag {
  view: MachineView;
  /** One or more registry keys to highlight, e.g. ["positive_socket", "negative_socket"] */
  highlights: string[];
  /**
   * When true the viewport draws an animated circuit path connecting highlighted
   * components in order. Use for polarity / wiring / connection explanations.
   */
  draw_path?: boolean;
}

// Matches: <spatial view="front" highlights="a,b" draw_path="true" />
//      or: <spatial view="front" highlights="a" />
const SPATIAL_RE =
  /<spatial\s+view="(front|interior|back)"\s+highlights="([^"]+)"(?:\s+draw_path="(true|false)")?\s*\/>/;

/** Returns the first <spatial> tag found in the text, or null. */
export function parseSpatialContext(text: string): SpatialContextTag | null {
  const m = SPATIAL_RE.exec(text);
  if (!m) return null;
  const highlights = m[2]
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return {
    view: m[1] as MachineView,
    highlights,
    draw_path: m[3] === 'true' ? true : m[3] === 'false' ? false : undefined,
  };
}

/** Strips all <spatial ... /> tags from text (for display). */
export function stripSpatialContext(text: string): string {
  return text.replace(/<spatial\s+[^/]*\/>/g, '').trim();
}

// ── Reference image extraction ─────────────────────────────────────────────────

/** Normalized-coordinate highlight box encoded in alt text as [x,y,w,h] or [x,y,w,h,Label]. */
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

const BOUNDS_RE = /\[(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)(?:,([^\]]+))?\]/;

/** Parse optional [x,y,w,h,Label] bounds from an image alt string. */
export function parseImageBounds(alt: string): { cleanAlt: string; bounds?: HighlightBounds } {
  const m = BOUNDS_RE.exec(alt);
  if (!m) return { cleanAlt: alt };
  const [x, y, width, height] = [m[1], m[2], m[3], m[4]].map(Number);
  if (x < 0 || x > 100 || y < 0 || y > 100 || width <= 0 || x + width > 100 || height <= 0 || y + height > 100) {
    return { cleanAlt: alt };
  }
  return {
    cleanAlt: alt.replace(m[0], '').trim() || 'Manual reference',
    bounds: { x, y, width, height, label: m[5]?.trim() || undefined },
  };
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** Extract all markdown images from text. */
export function parseReferenceImages(text: string): ReferenceImage[] {
  const images: ReferenceImage[] = [];
  IMAGE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMAGE_RE.exec(text)) !== null) {
    const { cleanAlt, bounds } = parseImageBounds(m[1] || 'Manual reference');
    images.push({ alt: cleanAlt, url: m[2], bounds });
  }
  return images;
}

/** Remove all markdown image syntax from text. */
export function stripReferenceImages(text: string): string {
  return text.replace(IMAGE_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

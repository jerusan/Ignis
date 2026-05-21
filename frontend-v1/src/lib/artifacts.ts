import type { ArtifactType } from '../components/ArtifactRenderer';
import type { ChatArtifact } from '../components/ChatPane';
import type { MachineView } from '../components/SpatialViewport';

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

const ARTIFACT_PATTERN =
  /<artifact\s+type="([^"]+)"\s+title="([^"]*)">([\s\S]*?)<\/artifact>/g;

const SUPPORTED_TYPES = new Set<ArtifactType>(['react', 'svg', 'html', 'checklist']);

export function parseArtifacts(text: string): ChatArtifact[] {
  const artifacts: ChatArtifact[] = [];
  ARTIFACT_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ARTIFACT_PATTERN.exec(text)) !== null) {
    const type = match[1] as ArtifactType;
    if (!SUPPORTED_TYPES.has(type)) continue;

    artifacts.push({
      id: `artifact-${match.index}-${artifacts.length}`,
      type,
      title: match[2] || 'Interactive artifact',
      code: match[3].trim()
    });
  }

  return artifacts;
}

export function stripArtifacts(text: string): string {
  return text.replace(ARTIFACT_PATTERN, '').trim();
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

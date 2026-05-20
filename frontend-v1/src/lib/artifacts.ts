import type { ArtifactType } from '../components/ArtifactRenderer';
import type { ChatArtifact } from '../components/ChatPane';

const ARTIFACT_PATTERN =
  /<artifact\s+type="([^"]+)"\s+title="([^"]*)">([\s\S]*?)<\/artifact>/g;

const SUPPORTED_TYPES = new Set<ArtifactType>(['react', 'svg', 'html']);

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

export type ArtifactType = "react" | "svg" | "html";

export interface Artifact {
  type: ArtifactType;
  title: string;
  code: string;
}

const ARTIFACT_RE = /<artifact\s+type="([^"]+)"\s+title="([^"]*)">([\s\S]*?)<\/artifact>/g;

export function parseArtifacts(text: string): Artifact[] {
  const artifacts: Artifact[] = [];
  let match: RegExpExecArray | null;
  ARTIFACT_RE.lastIndex = 0;
  while ((match = ARTIFACT_RE.exec(text)) !== null) {
    artifacts.push({
      type: match[1] as ArtifactType,
      title: match[2],
      code: match[3].trim(),
    });
  }
  return artifacts;
}

export function stripArtifacts(text: string): string {
  return text.replace(/<artifact[\s\S]*?<\/artifact>/g, "").trim();
}

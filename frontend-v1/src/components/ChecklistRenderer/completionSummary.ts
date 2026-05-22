import type { SessionState } from '../../lib/chatApi';

export function formatSetupSummary(sessionState: SessionState): string {
  const values = [
    sessionState.process,
    sessionState.material,
    sessionState.thickness,
    sessionState.voltage,
    sessionState.wire_size,
  ].filter((value): value is string => Boolean(value?.trim()));

  return values.length > 0
    ? `Setup: ${values.join(', ')}`
    : 'Setup: Selected parameters saved';
}

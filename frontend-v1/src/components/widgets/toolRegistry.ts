import type { ChatArtifact } from '../../types/chat';

export interface RegistryEntry {
  widgetName: string;
  title: string;
}

/**
 * Maps a tool_use intent and its arguments to a pre-built React widget.
 * Decouples the chat text parser from artifact rendering by checking tool calls directly.
 */
export function mapToolCallToWidget(
  toolName: string,
  input?: Record<string, any>
): RegistryEntry | null {
  const specType = input?.spec_type;
  const imageId = input?.image_id;

  if (toolName === 'get_machine_spec') {
    if (specType === 'duty_cycle') {
      return {
        widgetName: 'DutyCycleCalculator',
        title: 'Duty Cycle Calculator',
      };
    }
    if (specType === 'wire_settings' || specType === 'gas_settings') {
      return {
        widgetName: 'WireSettings',
        title: 'Wire & Gas Settings',
      };
    }
  }

  if (toolName === 'get_visual') {
    if (imageId?.includes('polarity') || imageId?.includes('setup')) {
      return {
        widgetName: 'PolarityDiagram',
        title: 'Polarity Configurator',
      };
    }
  }

  return null;
}

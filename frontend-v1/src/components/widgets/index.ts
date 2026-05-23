import React from 'react';
import { DutyCycleWidget } from './DutyCycleWidget';
import { WireSettingsWidget } from './WireSettingsWidget';
import { PolarityConfigurator } from '../PolarityConfigurator';

export { DutyCycleWidget } from './DutyCycleWidget';
export { WireSettingsWidget } from './WireSettingsWidget';

export type WidgetName = 'DutyCycleCalculator' | 'PolarityDiagram' | 'WireSettings';

const PolarityWidget = ({ params }: { params: Record<string, unknown> }) =>
  React.createElement(PolarityConfigurator, {
    initialProcess: typeof params.process === 'string' ? params.process : undefined,
  });

export const WIDGET_REGISTRY: Record<string, React.ComponentType<{ params: Record<string, unknown> }>> = {
  DutyCycleCalculator: DutyCycleWidget,
  PolarityDiagram:     PolarityWidget,
  WireSettings:        WireSettingsWidget,
};

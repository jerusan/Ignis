import React from 'react';
import { DutyCycleWidget } from './DutyCycleWidget';
import { WireSettingsWidget } from './WireSettingsWidget';
import { PolarityConfigurator } from '../PolarityConfigurator';

export { DutyCycleWidget } from './DutyCycleWidget';
export { WireSettingsWidget } from './WireSettingsWidget';

export type WidgetName = 'DutyCycleCalculator' | 'PolarityDiagram' | 'WireSettings';

// Thin adapter — PolarityConfigurator reads process from workbench session state,
// which the agent sets before emitting the artifact, so params are not needed.
const PolarityWidget = (_: { params: Record<string, unknown> }) =>
  React.createElement(PolarityConfigurator);

export const WIDGET_REGISTRY: Record<string, React.ComponentType<{ params: Record<string, unknown> }>> = {
  DutyCycleCalculator: DutyCycleWidget,
  PolarityDiagram:     PolarityWidget,
  WireSettings:        WireSettingsWidget,
};

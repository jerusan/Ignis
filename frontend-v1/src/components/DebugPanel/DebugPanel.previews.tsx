import React, { Component } from 'react';
import DebugPanel from './index';
import type { ComponentPreviewModule } from '../previewTypes';
const sampleTurns = [
{
  id: 'turn_01',
  label: 'Duty cycle MIG 200A/240V',
  latencyMs: 1840,
  inputTokens: 38420,
  outputTokens: 312,
  costUsd: 0.119,
  toolsCalled: ['get_machine_spec']
},
{
  id: 'turn_02',
  label: 'Porosity diagnostic',
  latencyMs: 4210,
  inputTokens: 38980,
  outputTokens: 540,
  costUsd: 0.124,
  toolsCalled: ['diagnose_defect', 'diagnose_defect', 'get_visual']
}];

const previews: ComponentPreviewModule = {
  componentName: 'DebugPanel',
  importPath: 'components/DebugPanel',
  previews: [
  {
    name: 'Collapsed (default)',
    description:
    'How the panel looks docked at the bottom of the chat shell.',
    render: () => <DebugPanel turns={sampleTurns} />
  },
  {
    name: 'Expanded',
    description:
    'Open state showing per-turn latency, tokens, cost, and tool calls.',
    render: () => <DebugPanel turns={sampleTurns} defaultOpen />
  },
  {
    name: 'Empty',
    description: 'No turns yet — fresh session.',
    render: () => <DebugPanel turns={[]} defaultOpen />
  }]

};
export default previews;
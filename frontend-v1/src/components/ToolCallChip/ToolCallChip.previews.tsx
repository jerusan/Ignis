import React, { Component } from 'react';
import ToolCallChip from './index';
import type { ComponentPreviewModule } from '../previewTypes';
const previews: ComponentPreviewModule = {
  componentName: 'ToolCallChip',
  importPath: 'components/ToolCallChip',
  previews: [
  {
    name: 'Spec lookup — running',
    description: 'In-flight call to get_machine_spec.',
    render: () => <ToolCallChip tool="get_machine_spec" status="running" />
  },
  {
    name: 'Diagnostic — done',
    description: 'Completed diagnose_defect with input/result, expanded.',
    render: () =>
    <ToolCallChip
      tool="diagnose_defect"
      status="done"
      defaultOpen
      input={{
        defect: 'porosity',
        process: 'flux-cored',
        node_id: 'root'
      }}
      result="Next question: Is the gas shielding turned off (flux-cored is self-shielded)?" />


  },
  {
    name: 'Visual — collapsed',
    description: 'Completed get_visual with collapsed details.',
    render: () =>
    <ToolCallChip
      tool="get_visual"
      status="done"
      input={{
        image_id: 'tig_polarity_diagram'
      }}
      result="Found assets/page_22.png — TIG polarity wiring diagram." />


  },
  {
    name: 'Error',
    description: 'Tool call that failed.',
    render: () =>
    <ToolCallChip
      tool="search_manual"
      status="error"
      input={{
        section: 'plasma_cutting'
      }}
      result="No matching chunk found." />


  }]

};
export default previews;
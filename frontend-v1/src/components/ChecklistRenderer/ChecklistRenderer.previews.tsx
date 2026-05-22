import React from 'react';
import ChecklistRenderer from './index';
import { WorkbenchProvider } from '../WorkbenchOverlay';
import type { ComponentPreviewModule } from '../previewTypes';

const MOCK_STEPS = JSON.stringify([
  {
    id: 's1',
    text: 'Set Process Switch to MIG',
    detail: 'Rotate the process selector on the front panel to the MIG position.',
    spatial: { view: 'front', highlights: ['process_switch'], draw_path: false },
  },
  {
    id: 's2',
    text: 'Connect Drive Roll (0.030")',
    detail: 'Open the wire drive access door and install the correct groove drive roll.',
    spatial: { view: 'interior', highlights: ['drive_roll_assembly'], draw_path: true },
  },
  {
    id: 's3',
    text: 'Set Voltage to 22V',
    detail: 'Turn the voltage knob to position 4 (≈22V) for 0.030" wire on 3/16" steel.',
    spatial: { view: 'front', highlights: ['voltage_knob'], draw_path: false },
  },
  {
    id: 's4',
    text: 'Set Wire Feed Speed to 280 IPM',
    spatial: { view: 'front', highlights: ['wire_feed_knob'], draw_path: false },
  },
  {
    id: 's5',
    text: 'Verify Ground Clamp Connection',
    detail: 'Attach the ground clamp to clean bare metal as close to the weld area as possible.',
    spatial: { view: 'back', highlights: ['ground_terminal'], draw_path: false },
  },
]);

const previews: ComponentPreviewModule = {
  componentName: 'ChecklistRenderer',
  importPath: './ChecklistRenderer',
  description: 'Task-centric accordion-wizard checklist for the Setup & Status HUD.',
  previews: [
    {
      name: 'Active wizard — step 1',
      description: 'Accordion-wizard with first step active (amber), rest pending.',
      render: () => (
        <WorkbenchProvider>
          <div style={{ width: 340, backgroundColor: '#141418', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
            <ChecklistRenderer
              id="preview-1"
              title="MIG Setup"
              code={MOCK_STEPS}
            />
          </div>
        </WorkbenchProvider>
      ),
    },
  ],
};

export default previews;

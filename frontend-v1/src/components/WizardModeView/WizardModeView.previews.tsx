import { useState } from 'react';
import WizardModeView from '../WizardModeView';
import type { WizardStep } from '../WizardModeView';
import type { ComponentPreviewModule } from '../previewTypes';

const shieldingGasSteps: WizardStep[] = [
  {
    text: 'Locate the gas inlet',
    detail: 'The gas inlet is on the rear panel. Connect your shielding gas hose here.',
    spatial: { view: 'back', highlights: ['gas_inlet'] },
  },
  {
    text: 'Set regulator flow rate',
    detail: 'Turn regulator to 20–25 SCFH for MIG solid wire.',
    spatial: { view: 'back', highlights: ['gas_inlet'] },
  },
  {
    text: 'Connect MIG gun socket',
    detail: 'Plug the MIG gun into the front panel socket. Ensure the collar is tight.',
    spatial: { view: 'front', highlights: ['mig_gun_spool_gun_cable_socket', 'spool_gun_gas_outlet'] },
  },
  {
    text: 'Verify polarity — DCEP',
    detail: 'Electrode positive: torch to + socket, work lead to − socket.',
    spatial: {
      view: 'front',
      highlights: ['positive_socket', 'negative_socket'],
      draw_path: true,
    },
  },
];

const wireFeedSteps: WizardStep[] = [
  {
    text: 'Open wire spool cover',
    detail: 'Lift the side panel to access the wire spool compartment.',
    spatial: { view: 'interior', highlights: ['wire_spool'] },
  },
  {
    text: 'Thread wire through inlet liner',
    detail: 'Feed wire tip through the inlet liner guide.',
    spatial: { view: 'interior', highlights: ['wire_inlet_liner'] },
  },
  {
    text: 'Set feed roller tension',
    detail: 'Turn the feed tensioner knob — 3 clicks for 0.030" wire.',
    spatial: { view: 'interior', highlights: ['feed_tensioner', 'feed_roller_knob'] },
  },
  {
    text: 'Run cold wire feed test',
    detail: 'Press the cold wire feed switch to advance wire without arcing.',
    spatial: { view: 'interior', highlights: ['cold_wire_feed_switch'] },
  },
];

function WizardPreview({ steps, title }: { steps: WizardStep[]; title: string }) {
  const [idx, setIdx] = useState(0);
  return (
    <div style={{ height: '760px', overflow: 'hidden' }}>
      <WizardModeView
        title={title}
        steps={steps}
        currentStepIdx={idx}
        onNext={() => setIdx((i) => Math.min(i + 1, steps.length - 1))}
        onExit={() => setIdx(0)}
      />
    </div>
  );
}

const previews: ComponentPreviewModule = {
  componentName: 'WizardModeView',
  importPath: 'components/WizardModeView',
  previews: [
    {
      name: 'Shielding Gas Setup — with spatial highlights',
      description: 'Four-step procedure with rear and front panel highlights.',
      render: () => <WizardPreview steps={shieldingGasSteps} title="Shielding Gas Setup" />,
    },
    {
      name: 'Wire Feed Setup — interior highlights',
      description: 'Four-step interior procedure with feed mechanism highlights.',
      render: () => <WizardPreview steps={wireFeedSteps} title="Wire Feed Setup" />,
    },
  ],
};

export default previews;

import React, { useState, Component } from 'react';
import ArtifactRenderer from './index';
import type { ComponentPreviewModule } from '../previewTypes';
const dutyCycleCalc = `function App() {
  const [amps, setAmps] = useState(150);
  const dutyCycle = amps >= 200 ? 30 : amps >= 150 ? 60 : 100;
  useEffect(() => {
    updateWorkbench({ process: 'MIG', voltage: '240V', amperage: String(amps) });
  }, [amps]);
  return (
    <div style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h2 style={{ margin: 0 }}>Duty Cycle — MIG @ 240V</h2>
      <input
        type="range"
        min={50}
        max={220}
        value={amps}
        onChange={(e) => setAmps(Number(e.target.value))}
        style={{ width: '100%', marginTop: 16 }}
      />
      <div style={{ marginTop: 12, fontSize: 28, fontWeight: 600 }}>
        {amps}A · {dutyCycle}% duty
      </div>
      <div style={{ color: '#555', marginTop: 4 }}>
        {dutyCycle === 100 ? 'Continuous' : (dutyCycle / 10) + ' min on / ' + (10 - dutyCycle / 10) + ' min off'}
      </div>
    </div>
  );
}`;
const polaritySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180">
  <rect x="20" y="40" width="120" height="100" rx="8" fill="#e0e7ff" stroke="#3b3a8c" stroke-width="2"/>
  <text x="80" y="95" text-anchor="middle" font-family="system-ui" font-size="13" fill="#1e1b4b">Welder</text>
  <text x="80" y="115" text-anchor="middle" font-family="system-ui" font-size="11" fill="#444">DCEN</text>
  <circle cx="140" cy="70" r="6" fill="#dc2626"/>
  <circle cx="140" cy="110" r="6" fill="#1f2937"/>
  <line x1="146" y1="70" x2="240" y2="70" stroke="#dc2626" stroke-width="2"/>
  <line x1="146" y1="110" x2="240" y2="110" stroke="#1f2937" stroke-width="2"/>
  <text x="250" y="74" font-family="system-ui" font-size="12" fill="#dc2626">Workpiece (+)</text>
  <text x="250" y="114" font-family="system-ui" font-size="12" fill="#1f2937">TIG Torch (−)</text>
</svg>`;
const porositySolvingMermaid = `flowchart TD
  A[Porosity in weld?] --> B{Gas shielding OK?}
  B -- No --> C[Check gas flow rate\\n15–25 CFH for MIG]
  B -- Yes --> D{Base metal clean?}
  D -- No --> E[Grind / degrease metal\\nRemove rust and mill scale]
  D -- Yes --> F{Wire condition OK?}
  F -- No --> G[Replace wire spool\\nAvoid rusty or damp wire]
  F -- Yes --> H{Travel speed correct?}
  H -- Too fast --> I[Slow down — let\\nshielding gas cover pool]
  H -- OK --> J[Check for drafts\\nWind can disperse shielding gas]`;

const migSetupMarkdown = `## MIG Setup Checklist — 240V

| Parameter | Value |
|---|---|
| Process | MIG (GMAW) |
| Input | 240V / 50A circuit |
| Wire | ER70S-6, 0.030" or 0.035" |
| Gas | 75/25 Ar/CO₂ @ 20 CFH |

### Steps
1. Set polarity to **DCEP** (electrode positive)
2. Thread wire through inlet liner and drive rolls
3. Set wire feed speed for material thickness
4. Set voltage to match wire speed (synergic mode)
5. Run a test bead on scrap metal before welding`;

const previews: ComponentPreviewModule = {
  componentName: 'ArtifactRenderer',
  importPath: 'components/ArtifactRenderer',
  previews: [
  {
    name: 'Widget — DutyCycleCalculator (MIG 240V)',
    description: 'Pre-built duty cycle widget — no iframe, native React.',
    render: () =>
    <ArtifactRenderer
      type="widget"
      widgetName="DutyCycleCalculator"
      title="Duty Cycle Calculator"
      code='{"process":"MIG","voltage":"240V"}'
      source_pages="12,13"
      height={360} />,
  },
  {
    name: 'Widget — PolarityDiagram (PolarityConfigurator)',
    description: 'Polarity widget — renders the full PolarityConfigurator panel component.',
    render: () =>
    <ArtifactRenderer
      type="widget"
      widgetName="PolarityDiagram"
      title="Process Polarity & Gas"
      code='{"process":"TIG"}'
      source_pages="13,14,24,27"
      height={420} />,
  },
  {
    name: 'Widget — WireSettings (MIG)',
    description: 'Pre-built wire settings configurator widget.',
    render: () =>
    <ArtifactRenderer
      type="widget"
      widgetName="WireSettings"
      title="Wire Feed Settings"
      code='{"process":"MIG"}'
      source_pages="18,19"
      height={420} />,
  },
  {
    name: 'React — duty cycle calculator',
    description:
    'Interactive React artifact rendered inside the sandboxed iframe.',
    render: () =>
    <ArtifactRenderer
      type="react"
      title="Duty Cycle Calculator"
      code={dutyCycleCalc} />


  },
  {
    name: 'SVG — polarity diagram',
    description: 'Static SVG artifact for a TIG polarity wiring diagram.',
    render: () =>
    <ArtifactRenderer
      type="svg"
      title="TIG Polarity (DCEN)"
      code={polaritySvg}
      source_pages="13,14"
      height={240} />


  },
  {
    name: 'Code view',
    description: 'Same artifact opened to its source code view.',
    render: () =>
    <ArtifactRenderer
      type="react"
      title="Duty Cycle Calculator"
      code={dutyCycleCalc}
      defaultView="code"
      height={260} />
  },
  {
    name: 'Mermaid — porosity diagnostic',
    description: 'Troubleshooting flowchart for porosity rendered via Mermaid.',
    render: () =>
    <ArtifactRenderer
      type="mermaid"
      title="Porosity Diagnostic"
      code={porositySolvingMermaid}
      source_pages="41,42"
      height={420} />
  },
  {
    name: 'Markdown — MIG setup card',
    description: 'Procedure card rendered inline as styled markdown.',
    render: () =>
    <ArtifactRenderer
      type="markdown"
      title="MIG Setup — 240V"
      code={migSetupMarkdown}
      source_pages="8,9"
      height={320} />
  }]

};
export default previews;
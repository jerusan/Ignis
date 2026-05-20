import React, { useState, Component } from 'react';
import ArtifactRenderer from './index';
import type { ComponentPreviewModule } from '../previewTypes';
const dutyCycleCalc = `function App() {
  const [amps, setAmps] = useState(150);
  const dutyCycle = amps >= 200 ? 30 : amps >= 150 ? 60 : 100;
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
const previews: ComponentPreviewModule = {
  componentName: 'ArtifactRenderer',
  importPath: 'components/ArtifactRenderer',
  previews: [
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


  }]

};
export default previews;
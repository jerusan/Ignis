import React, { useState, createElement, Component } from 'react';
import ChatPane, { ChatMessage } from './index';
import type { ComponentPreviewModule } from '../previewTypes';
const polaritySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" width="320" height="160">
  <rect x="20" y="30" width="120" height="100" rx="8" fill="#e0e7ff" stroke="#3b3a8c" stroke-width="2"/>
  <text x="80" y="80" text-anchor="middle" font-family="system-ui" font-size="13" fill="#1e1b4b">Welder</text>
  <text x="80" y="100" text-anchor="middle" font-family="system-ui" font-size="11" fill="#444">DCEN</text>
  <circle cx="140" cy="60" r="6" fill="#dc2626"/>
  <circle cx="140" cy="100" r="6" fill="#1f2937"/>
  <line x1="146" y1="60" x2="240" y2="60" stroke="#dc2626" stroke-width="2"/>
  <line x1="146" y1="100" x2="240" y2="100" stroke="#1f2937" stroke-width="2"/>
  <text x="250" y="64" font-family="system-ui" font-size="12" fill="#dc2626">Work (+)</text>
  <text x="250" y="104" font-family="system-ui" font-size="12" fill="#1f2937">Torch (−)</text>
</svg>`;
const dutyCalc = `function App() {
  const [a, setA] = useState(180);
  const dc = a >= 200 ? 30 : a >= 150 ? 60 : 100;
  return createElement('div', { style: { fontFamily: 'system-ui', padding: 12 } },
    createElement('div', { style: { fontWeight: 600, marginBottom: 8 } }, 'MIG @ 240V'),
    createElement('input', { type: 'range', min: 50, max: 220, value: a, onChange: e => setA(Number(e.target.value)), style: { width: '100%' } }),
    createElement('div', { style: { fontSize: 22, marginTop: 6 } }, a + 'A · ' + dc + '% duty')
  );
}`;
const sampleConversation: ChatMessage[] = [
{
  id: 'm1',
  role: 'user',
  text: 'What polarity should I use for TIG on aluminum?',
  timestamp: '2:14 PM'
},
{
  id: 'm2',
  role: 'assistant',
  text: 'For TIG on aluminum you want AC, not DC. The OmniPro 220 supports this — set the process switch to TIG AC. Torch goes into the negative socket; work clamp goes positive.',
  timestamp: '2:14 PM',
  toolCalls: [
  {
    id: 't1',
    tool: 'search_manual',
    status: 'done',
    input: {
      section: 'tig_torch_assembly'
    },
    result: 'Found chunk tig_torch_assembly.md (pp. 23–25).'
  },
  {
    id: 't2',
    tool: 'get_visual',
    status: 'done',
    input: {
      image_id: 'tig_polarity_diagram'
    }
  }],

  artifacts: [
  {
    id: 'a1',
    type: 'svg',
    title: 'TIG Polarity Wiring',
    code: polaritySvg
  }]

},
{
  id: 'm3',
  role: 'user',
  text: 'Can you show duty cycle for MIG at 240V?',
  timestamp: '2:16 PM'
},
{
  id: 'm4',
  role: 'assistant',
  text: 'Here is a quick calculator using the three breakpoints from the spec table.',
  timestamp: '2:16 PM',
  toolCalls: [
  {
    id: 't3',
    tool: 'get_machine_spec',
    status: 'done',
    input: {
      spec_type: 'duty_cycles',
      process: 'mig',
      voltage: 240
    }
  }],

  artifacts: [
  {
    id: 'a2',
    type: 'react',
    title: 'Duty Cycle — MIG @ 240V',
    code: dutyCalc
  }]

}];

const streamingConversation: ChatMessage[] = [
{
  id: 'm1',
  role: 'user',
  text: "I'm getting porosity on flux-cored — what's wrong?",
  timestamp: '2:20 PM'
},
{
  id: 'm2',
  role: 'assistant',
  text: 'Walking the diagnostic tree now',
  streaming: true,
  timestamp: '2:20 PM',
  toolCalls: [
  {
    id: 't1',
    tool: 'diagnose_defect',
    status: 'running',
    input: {
      defect: 'porosity',
      process: 'flux-cored'
    }
  }]
}];

// Simulates a message mid-stream where the agent has started emitting an
// artifact tag but hasn't closed it yet — should show the building animation.
const streamingArtifactConversation: ChatMessage[] = [
  {
    id: 'sa1',
    role: 'user',
    text: "Show me a duty cycle calculator for MIG at 240V.",
    timestamp: '3:10 PM',
  },
  {
    id: 'sa2',
    role: 'assistant',
    text: 'Here\'s an interactive calculator based on the spec table.\n\n<artifact type="react" title="Duty Cycle — MIG @ 240V">\nfunction App() {\n  const [a, setA] = use',
    streaming: true,
    timestamp: '3:10 PM',
  },
];

const spatialConversation: ChatMessage[] = [
  {
    id: 's1',
    role: 'user',
    text: 'Show me the wire feed setup for flux-cored.',
    timestamp: '3:00 PM',
  },
  {
    id: 's2',
    role: 'assistant',
    text: 'For flux-cored wire feed, start by setting the correct polarity. Flux-cored (self-shielded) runs **DCEN** — electrode negative.',
    timestamp: '3:00 PM',
    spatialContext: {
      view: 'front',
      highlights: ['negative_socket', 'positive_socket'],
      draw_path: true,
    },
  },
  {
    id: 's3',
    role: 'user',
    text: 'Done with polarity. Next?',
    timestamp: '3:01 PM',
  },
  {
    id: 's4',
    role: 'assistant',
    text: 'Good. Now open the side panel and set the **idler arm tension**. Press the arm down, thread the wire through the inlet liner, then set the feed tensioner to about 3–4 on the scale.',
    timestamp: '3:01 PM',
    spatialContext: {
      view: 'interior',
      highlights: ['idler_arm', 'feed_tensioner', 'wire_inlet_liner'],
    },
  },
];

const previews: ComponentPreviewModule = {
  componentName: 'ChatPane',
  importPath: 'components/ChatPane',
  previews: [
  {
    name: 'Inline machine visuals',
    description:
      'Two-step procedure with embedded SpatialViewport highlights and step thumbnails.',
    render: () =>
      <div className="h-[700px] border border-background-subtle rounded-lg overflow-hidden">
        <ChatPane messages={spatialConversation} onSend={() => {}} onVoiceToggle={() => {}} />
      </div>,
  },
  {
    name: 'Full conversation',
    description:
    'Two-turn conversation with tool calls and both artifact types.',
    render: () =>
    <div className="h-[640px] border border-background-subtle rounded-lg overflow-hidden">
          <ChatPane messages={sampleConversation} onVoiceToggle={() => {}} />
        </div>

  },
  {
    name: 'Streaming + tool running',
    description:
    'Assistant mid-response while a diagnostic tool is in flight.',
    render: () =>
    <div className="h-[480px] border border-background-subtle rounded-lg overflow-hidden">
          <ChatPane
        messages={streamingConversation}
        voiceState="idle"
        onVoiceToggle={() => {}} />
        </div>
  },
  {
    name: 'Streaming artifact building',
    description:
      'Partial <artifact> tag mid-stream — raw XML hidden, building animation shown.',
    render: () =>
    <div className="h-[360px] border border-background-subtle rounded-lg overflow-hidden">
      <ChatPane
        messages={streamingArtifactConversation}
        voiceState="idle"
        onVoiceToggle={() => {}} />
    </div>
  },
  {
    name: 'Empty state',
    description: 'Fresh session with the default welcome panel.',
    render: () =>
    <div className="h-[420px] border border-background-subtle rounded-lg overflow-hidden">
          <ChatPane messages={[]} onVoiceToggle={() => {}} />
        </div>

  },
  {
    name: 'Offline',
    description: 'Offline banner is shown when navigator.onLine === false.',
    render: () =>
    <div className="h-[420px] border border-background-subtle rounded-lg overflow-hidden">
          <ChatPane
        messages={sampleConversation.slice(0, 2)}
        offline
        onVoiceToggle={() => {}} />
      
        </div>

  }]

};
export default previews;
import React, { Component } from 'react';
import VoiceButton from './index';
import type { ComponentPreviewModule } from '../previewTypes';
const previews: ComponentPreviewModule = {
  componentName: 'VoiceButton',
  importPath: 'components/VoiceButton',
  previews: [
  {
    name: 'All states',
    description: 'Idle, recording, processing, disabled — at medium size.',
    render: () =>
    <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <VoiceButton state="idle" />
            <span className="text-xs text-foreground-muted">idle</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <VoiceButton state="recording" />
            <span className="text-xs text-foreground-muted">recording</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <VoiceButton state="processing" />
            <span className="text-xs text-foreground-muted">processing</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <VoiceButton state="disabled" />
            <span className="text-xs text-foreground-muted">disabled</span>
          </div>
        </div>

  },
  {
    name: 'Sizes',
    description: 'Small, medium, large.',
    render: () =>
    <div className="flex items-center gap-6">
          <VoiceButton state="idle" size="sm" />
          <VoiceButton state="idle" size="md" />
          <VoiceButton state="idle" size="lg" />
        </div>

  },
  {
    name: 'Recording — large',
    description: 'Large recording state with the active ping ring.',
    render: () => <VoiceButton state="recording" size="lg" />
  }]

};
export default previews;
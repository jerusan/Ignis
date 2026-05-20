import React, { Component } from 'react';
import Message from './index';
import type { ComponentPreviewModule } from '../previewTypes';
const previews: ComponentPreviewModule = {
  componentName: 'Message',
  importPath: 'components/Message',
  previews: [
  {
    name: 'User message',
    description: 'A user-authored message bubble.',
    render: () =>
    <Message role="user" timestamp="2:14 PM">
          What's the duty cycle for MIG at 200A on 240V?
        </Message>

  },
  {
    name: 'Assistant message',
    description: 'An assistant message with technical content.',
    render: () =>
    <Message role="assistant" timestamp="2:14 PM">
          At 200A on 240V input, MIG duty cycle is 30% — meaning 3 minutes of
          welding per 10-minute cycle. Below 150A you get 60%, and below 100A
          you can weld continuously.
        </Message>

  },
  {
    name: 'Streaming',
    description: 'Assistant message with active streaming indicator.',
    render: () =>
    <Message role="assistant" streaming>
          Checking the spec table now
        </Message>

  }]

};
export default previews;
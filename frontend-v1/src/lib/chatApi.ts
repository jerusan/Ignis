import type {
  ApiMessage,
  SessionState,
  ChatStreamEvent,
  ChatRequest,
} from '../types/chat';

export type {
  ApiMessage,
  SessionState,
  ChatStreamEvent,
  ChatRequest,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeEvent(value: unknown): ChatStreamEvent | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;

  if (value.type === 'text_delta' && typeof value.text === 'string') {
    return {
      type: 'text_delta',
      text: value.text
    };
  }

  if (value.type === 'tool_use' && typeof value.name === 'string') {
    return {
      type: 'tool_use',
      name: value.name,
      input: isRecord(value.input) ? value.input : {}
    };
  }

  if (value.type === 'tool_result' && typeof value.tool === 'string') {
    return {
      type: 'tool_result',
      tool: value.tool,
      content: value.content
    };
  }

  if (value.type === 'done') {
    return {
      type: 'done',
      input_tokens:
        typeof value.input_tokens === 'number' ? value.input_tokens : 0,
      output_tokens:
        typeof value.output_tokens === 'number' ? value.output_tokens : 0,
      session_context: isRecord(value.session_context)
        ? (value.session_context as unknown as SessionState)
        : undefined
    };
  }

  return null;
}

function parseSseEvents(buffer: string): {
  events: ChatStreamEvent[];
  rest: string;
} {
  const events: ChatStreamEvent[] = [];
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.startsWith('data: ')) continue;

    try {
      const event = normalizeEvent(JSON.parse(line.slice(6)));
      if (event) events.push(event);
    } catch {
      // Ignore malformed partial events; the next well-formed event can continue.
    }
  }

  return { events, rest };
}

/** Fire-and-forget telemetry for checklist step completion. Fails silently. */
export function silentChecklistStep(
  sessionId: string,
  stepId: string,
  stepText: string
): void {
  fetch('/step_complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, step_id: stepId, step_text: stepText }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => { /* intentionally silent */ });
}

export async function* streamChat({
  messages,
  sessionId
}: ChatRequest): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch('/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      session_id: sessionId
    })
  });

  if (!response.ok) {
    throw new Error(`Chat request failed with HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Chat response did not include a readable stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseEvents(buffer);
    buffer = parsed.rest;

    for (const event of parsed.events) {
      yield event;
    }
  }

  buffer += decoder.decode();
  const parsed = parseSseEvents(`${buffer}\n`);
  for (const event of parsed.events) {
    yield event;
  }
}

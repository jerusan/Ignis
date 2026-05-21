import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIcon,
  GaugeIcon
} from 'lucide-react';
import ChatPane, {
  ChatMessage,
  ChatToolCall
} from '../ChatPane';
import DebugPanel, { DebugTurn } from '../DebugPanel';
import { parseArtifacts } from '../../lib/artifacts';
import { ApiMessage, streamChat } from '../../lib/chatApi';
import { useWorkbench } from '../WorkbenchOverlay';

const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

const STARTER_PROMPTS = [
  'What polarity setup do I need for TIG welding?',
  "What's the duty cycle for MIG at 200A on 240V?",
  "I'm getting porosity in flux-cored welds.",
  'Show me the wire feed setup.'
];

function nowLabel(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date());
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stringifyToolResult(content: unknown): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

function updateAssistant(
  messages: ChatMessage[],
  id: string,
  updater: (message: ChatMessage) => ChatMessage
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id ? updater(message) : message
  );
}

function markToolDone(
  toolCalls: ChatToolCall[] | undefined,
  tool: string,
  result: string
): ChatToolCall[] {
  const calls = toolCalls ?? [];
  const runningIndex = calls.findIndex(
    (call) => call.tool === tool && call.status === 'running'
  );

  if (runningIndex === -1) {
    return [
      ...calls,
      {
        id: makeId('tool'),
        tool,
        status: 'done',
        result
      }
    ];
  }

  return calls.map((call, index) =>
    index === runningIndex
      ? {
          ...call,
          status: 'done',
          result
        }
      : call
  );
}

function EmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="max-w-2xl px-4 text-left">
      <img src="/ignis-logo.svg" alt="Ignis" className="mb-5 h-10 w-auto" />
      <h2 className="font-heading text-2xl font-semibold text-foreground">
        Ignis technician console
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-foreground-muted">
        Ask about setup, polarity, duty cycle, troubleshooting, or manual
        diagrams. Ignis will surface specs, diagnostic steps, diagrams, and
        interactive artifacts directly in the chat.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="rounded-md border border-background-subtle bg-background px-3 py-2 text-left text-sm text-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-background-muted">
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function IgnisApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turns, setTurns] = useState<DebugTurn[]>([]);
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionId = useRef(makeId('session'));
  const history = useRef<ApiMessage[]>([]);
  const { setArtifacts } = useWorkbench();

  useEffect(() => {
    const all = messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => m.artifacts ?? []);
    setArtifacts(all);
  }, [messages, setArtifacts]);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isStreaming) return;

      const userMessage: ChatMessage = {
        id: makeId('msg'),
        role: 'user',
        text,
        timestamp: nowLabel()
      };
      const assistantId = makeId('msg');
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: '',
        streaming: true,
        timestamp: nowLabel(),
        toolCalls: [],
        artifacts: []
      };

      setMessages((current) => [...current, userMessage, assistantMessage]);
      history.current = [...history.current, { role: 'user', content: text }];
      setIsStreaming(true);

      const startedAt = Date.now();
      const turnTools: string[] = [];
      let finalText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        for await (const event of streamChat({
          messages: history.current,
          sessionId: sessionId.current
        })) {
          if (event.type === 'text_delta') {
            finalText += event.text;
            setMessages((current) =>
              updateAssistant(current, assistantId, (message) => ({
                ...message,
                text: finalText,
                artifacts: parseArtifacts(finalText)
              }))
            );
          }

          if (event.type === 'tool_use') {
            const toolCall: ChatToolCall = {
              id: makeId('tool'),
              tool: event.name,
              status: 'running',
              input: event.input
            };
            turnTools.push(event.name);
            setMessages((current) =>
              updateAssistant(current, assistantId, (message) => ({
                ...message,
                toolCalls: [...(message.toolCalls ?? []), toolCall]
              }))
            );
          }

          if (event.type === 'tool_result') {
            const result = stringifyToolResult(event.content);
            setMessages((current) =>
              updateAssistant(current, assistantId, (message) => ({
                ...message,
                toolCalls: markToolDone(message.toolCalls, event.tool, result)
              }))
            );
          }

          if (event.type === 'done') {
            inputTokens = event.input_tokens;
            outputTokens = event.output_tokens;
          }
        }
      } catch (error) {
        finalText = `Error: ${
          error instanceof Error ? error.message : String(error)
        }`;
        setMessages((current) =>
          updateAssistant(current, assistantId, (message) => ({
            ...message,
            text: finalText,
            toolCalls: (message.toolCalls ?? []).map((call) =>
              call.status === 'running' ? { ...call, status: 'error' } : call
            )
          }))
        );
      } finally {
        const latencyMs = Date.now() - startedAt;
        history.current = [
          ...history.current,
          { role: 'assistant', content: finalText }
        ];
        setMessages((current) =>
          updateAssistant(current, assistantId, (message) => ({
            ...message,
            streaming: false,
            artifacts: parseArtifacts(finalText)
          }))
        );
        setTurns((current) => [
          ...current,
          {
            id: `turn_${String(current.length + 1).padStart(2, '0')}`,
            label: text.length > 46 ? `${text.slice(0, 43)}...` : text,
            latencyMs,
            inputTokens,
            outputTokens,
            costUsd:
              inputTokens * INPUT_COST_PER_TOKEN +
              outputTokens * OUTPUT_COST_PER_TOKEN,
            toolsCalled: turnTools
          }
        ]);
        setIsStreaming(false);
      }
    },
    [isStreaming]
  );

  const totalTokens = turns.reduce(
    (sum, turn) => sum + turn.inputTokens + turn.outputTokens,
    0
  );
  const totalCost = turns.reduce((sum, turn) => sum + turn.costUsd, 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background-muted">
      <header className="border-b border-background-subtle bg-background">
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src="/ignis-logo.svg" alt="Ignis" className="h-8 w-auto" />
            <p className="text-xs text-foreground-muted">
              Vulcan OmniPro 220 · technician assistant
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs md:w-auto">
            <div className="rounded-md border border-background-subtle bg-background-muted px-3 py-2">
              <div className="flex items-center gap-1.5 text-foreground-subtle">
                <ActivityIcon className="h-3.5 w-3.5" />
                Turns
              </div>
              <div className="font-mono text-foreground">{turns.length}</div>
            </div>
            <div className="rounded-md border border-background-subtle bg-background-muted px-3 py-2">
              <div className="flex items-center gap-1.5 text-foreground-subtle">
                <GaugeIcon className="h-3.5 w-3.5" />
                Tokens
              </div>
              <div className="font-mono text-foreground">
                {totalTokens.toLocaleString()}
              </div>
            </div>
            <div className="rounded-md border border-background-subtle bg-background-muted px-3 py-2">
              <div className="flex items-center gap-1.5 text-foreground-subtle">
                $
                Cost
              </div>
              <div className="font-mono text-foreground">
                ${totalCost.toFixed(4)}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <section className="min-h-0 flex-1">
          <ChatPane
            messages={messages}
            onSend={sendMessage}
            offline={offline}
            disabled={isStreaming}
            emptyState={<EmptyState onPrompt={sendMessage} />}
          />
        </section>
        <div className="border-t border-background-subtle bg-background p-3">
          <DebugPanel turns={turns} />
        </div>
      </main>
    </div>
  );
}

export default IgnisApp;

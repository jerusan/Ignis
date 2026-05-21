import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatPane, {
  ChatMessage,
  ChatToolCall
} from '../ChatPane';
import WizardModeView, {
  WizardStep,
  parseTextWizardSteps,
} from '../WizardModeView';
import { parseArtifacts, parseSpatialContext } from '../../lib/artifacts';
import type { ChecklistStep } from '../../lib/artifacts';
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
      { id: makeId('tool'), tool, status: 'done', result }
    ];
  }

  return calls.map((call, index) =>
    index === runningIndex ? { ...call, status: 'done', result } : call
  );
}

// ── Setup-complete banner ─────────────────────────────────────────────────────

function SetupCompleteCard({ title, onDismiss }: { title: string; onDismiss: () => void }) {
  return (
    <div
      className="mx-4 mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 animate-slide-down"
      style={{
        backgroundColor: 'rgba(255,107,0,0.1)',
        border: '1px solid rgba(255,107,0,0.3)',
      }}
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: '#ff6b00' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
             strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: '#e6e9ef' }}>
          Setup Complete
        </p>
        <p className="text-xs truncate" style={{ color: '#a3a9b8' }}>
          {title} finished successfully
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-xs w-6 h-6 rounded-full flex items-center justify-center
                   transition-colors hover:opacity-70"
        style={{ color: '#a3a9b8' }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="max-w-2xl px-4 text-left">
      <img src="/ignis-logo.svg" alt="Ignis" className="mb-5 h-10 w-auto" />
      <h2 className="font-heading text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
        Ignis technician console
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6" style={{ color: 'var(--foreground-muted)' }}>
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
            className="rounded-md px-3 py-2 text-left text-sm shadow-sm
                       transition-colors hover:opacity-80"
            style={{
              border: '1px solid var(--background-subtle)',
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function IgnisApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionId = useRef(makeId('session'));
  const history = useRef<ApiMessage[]>([]);
  const {
    setArtifacts, setSpatialContext, setSessionState, addTurn,
    registerSendMessage, setActiveChecklist, activeChecklist,
    registerSessionId,
  } = useWorkbench();

  // ── Wizard state ─────────────────────────────────────────────────────────
  // "text wizard" = triggered by detecting 3+ numbered steps in response text
  const [textWizard, setTextWizard] = useState<{
    title: string;
    steps: WizardStep[];
  } | null>(null);
  const [textWizardIdx, setTextWizardIdx] = useState(0);
  const [completedTitle, setCompletedTitle] = useState<string | null>(null);
  // Tracks message IDs whose wizard was explicitly dismissed — prevents re-trigger after Exit
  const dismissedMessageIds = useRef<Set<string>>(new Set());

  // Checklist-based wizard steps (parsed from the active checklist artifact)
  const checklistSteps = useMemo<WizardStep[]>(() => {
    if (!activeChecklist) return [];
    try {
      const parsed: unknown = JSON.parse(activeChecklist.code);
      if (!Array.isArray(parsed)) return [];
      return (parsed as ChecklistStep[]).map((s) => ({
        text: s.text,
        detail: s.detail,
        spatial: s.spatial,
      }));
    } catch {
      return [];
    }
  }, [activeChecklist]);

  // Explicit step index for checklist wizard — not derived from spatialContext
  const [checklistStepIdx, setChecklistStepIdx] = useState(0);

  // Is the wizard overlay currently showing?
  const isWizardMode = activeChecklist !== null || textWizard !== null;

  // ── Detect text-based wizard after streaming ends ─────────────────────────
  useEffect(() => {
    if (isStreaming) return;
    if (activeChecklist) return;   // checklist takes priority
    if (textWizard) return;        // already in wizard
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant?.text) return;
    if (dismissedMessageIds.current.has(lastAssistant.id)) return;  // user explicitly exited
    const parsed = parseTextWizardSteps(lastAssistant.text);
    if (parsed) {
      setTextWizard({ title: parsed.title, steps: parsed.steps });
      setTextWizardIdx(0);
    }
  }, [isStreaming, messages, activeChecklist, textWizard]);

  // ── Sync artifacts into workbench ─────────────────────────────────────────
  useEffect(() => {
    const all = messages
      .filter((m) => m.role === 'assistant')
      .flatMap((m) => m.artifacts ?? []);
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

  // ── Core send ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isStreaming) return;

      // Exit text wizard on new user message
      setTextWizard(null);
      setTextWizardIdx(0);

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
            const spatial = parseSpatialContext(finalText);
            if (spatial) setSpatialContext(spatial);
            setMessages((current) =>
              updateAssistant(current, assistantId, (message) => ({
                ...message,
                text: finalText,
                artifacts: parseArtifacts(finalText),
                spatialContext: spatial ?? message.spatialContext,
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
            if (event.session_context) setSessionState(event.session_context);
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
        const finalArtifacts = parseArtifacts(finalText);
        setMessages((current) =>
          updateAssistant(current, assistantId, (message) => ({
            ...message,
            streaming: false,
            artifacts: finalArtifacts,
            spatialContext: parseSpatialContext(finalText) ?? message.spatialContext,
          }))
        );
        const checklist = finalArtifacts.find((a) => a.type === 'checklist');
        if (checklist) setActiveChecklist(checklist);
        addTurn({
          id: `turn_${Date.now()}`,
          label: text.length > 46 ? `${text.slice(0, 43)}...` : text,
          latencyMs,
          inputTokens,
          outputTokens,
          costUsd:
            inputTokens * INPUT_COST_PER_TOKEN +
            outputTokens * OUTPUT_COST_PER_TOKEN,
          toolsCalled: turnTools
        });
        setIsStreaming(false);
      }
    },
    [isStreaming, setSpatialContext, setSessionState, addTurn, setActiveChecklist]
  );

  useEffect(() => {
    registerSendMessage(sendMessage);
  }, [registerSendMessage, sendMessage]);

  useEffect(() => {
    registerSessionId(sessionId.current);
  }, [registerSessionId]);

  // ── Wizard handlers ───────────────────────────────────────────────────────

  const handleWizardNext = useCallback(() => {
    if (activeChecklist) {
      const isLast = checklistStepIdx === checklistSteps.length - 1;
      if (isLast) {
        const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) dismissedMessageIds.current.add(lastAssistant.id);
        const title = activeChecklist.title;
        setActiveChecklist(null);
        setChecklistStepIdx(0);
        setCompletedTitle(title);
      } else {
        setChecklistStepIdx((i) => i + 1);
      }
    } else if (textWizard) {
      const isLast = textWizardIdx === textWizard.steps.length - 1;
      if (isLast) {
        const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) dismissedMessageIds.current.add(lastAssistant.id);
        setCompletedTitle(textWizard.title);
        setTextWizard(null);
        setTextWizardIdx(0);
      } else {
        setTextWizardIdx((i) => i + 1);
      }
    }
  }, [
    activeChecklist, checklistStepIdx, checklistSteps.length,
    setActiveChecklist, textWizard, textWizardIdx, messages,
  ]);

  const handleWizardExit = useCallback(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) dismissedMessageIds.current.add(lastAssistant.id);
    setActiveChecklist(null);
    setChecklistStepIdx(0);
    setTextWizard(null);
    setTextWizardIdx(0);
  }, [setActiveChecklist, messages]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Wizard mode — full-screen step layout
  if (isWizardMode) {
    const title = activeChecklist?.title ?? textWizard?.title ?? 'Procedure';
    const steps = activeChecklist ? checklistSteps : (textWizard?.steps ?? []);
    const stepIdx = activeChecklist ? checklistStepIdx : textWizardIdx;

    return (
      <div className="flex h-full min-h-0 flex-col" style={{ backgroundColor: '#0f1114' }}>
        <WizardModeView
          title={title}
          steps={steps}
          currentStepIdx={stepIdx}
          onNext={handleWizardNext}
          onExit={handleWizardExit}
        />
      </div>
    );
  }

  // Normal chat mode
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ backgroundColor: '#0f1114' }}>
      <header style={{ borderBottom: '1px solid #2a2f3b', backgroundColor: '#1a1d24' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <img src="/ignis-logo.svg" alt="Ignis" className="h-8 w-auto" />
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Vulcan OmniPro 220 · technician assistant
          </p>
        </div>
      </header>

      {/* Setup-complete banner — pinned above chat after wizard finishes */}
      {completedTitle && (
        <SetupCompleteCard
          title={completedTitle}
          onDismiss={() => setCompletedTitle(null)}
        />
      )}

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
      </main>
    </div>
  );
}

export default IgnisApp;

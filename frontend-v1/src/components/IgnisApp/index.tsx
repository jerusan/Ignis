import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ZapIcon, GaugeIcon, AlertCircleIcon, SlidersHorizontalIcon } from 'lucide-react';
import ChatPane from '../ChatPane';
import WizardModeView, {
  WizardStep,
  parseTextWizardSteps,
} from '../WizardModeView';
import {
  parseArtifacts,
  parseSpatialContext,
  WORKBENCH_ARTIFACT_TYPES,
  stripStreamingTags,
  stripSpatialContext,
  stripArtifacts,
  parseReferenceImages,
  stripReferenceImages,
} from '../../lib/artifacts';
import { streamChat } from '../../lib/chatApi';
import type { ChatMessage, ChatToolCall, ApiMessage } from '../../types/chat';
import { useWorkbench } from '../WorkbenchOverlay';

const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

const STARTER_PROMPTS: { text: string; Icon: React.ElementType }[] = [
  { text: 'What polarity setup do I need for TIG welding?', Icon: ZapIcon },
  { text: "What's the duty cycle for MIG at 200A on 240V?", Icon: GaugeIcon },
  { text: "I'm getting porosity in flux-cored welds.", Icon: AlertCircleIcon },
  { text: 'Show me the wire feed setup.', Icon: SlidersHorizontalIcon },
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

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="max-w-sm w-full px-4 py-2 text-left">
      {/* Brand lockup */}
      <div className="flex items-center gap-2.5 mb-7">
        <img src="/ignis-logo.svg" alt="Ignis" className="h-5 w-auto flex-shrink-0" />
        <div className="w-px h-3.5 flex-shrink-0 bg-white/10" />
        <span className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: 'rgba(255,107,0,0.7)' }}>
          Technician Assistant
        </span>
      </div>

      {/* Product title */}
      <h2
        className="font-heading text-xl font-semibold mb-1.5"
        style={{ color: '#e6e9ef', letterSpacing: '-0.01em' }}
      >
        Vulcan OmniPro 220
      </h2>
      <p className="text-sm leading-relaxed mb-7" style={{ color: '#5c6478' }}>
        Describe a fault, ask about parameters, or request a guided diagnostic.
      </p>

      {/* Section label */}
      <p className="text-[9px] font-mono uppercase tracking-[0.2em] mb-2" style={{ color: '#2e3550' }}>
        Suggested
      </p>

      {/* Suggestion cards */}
      <div className="space-y-1.5">
        {STARTER_PROMPTS.map(({ text, Icon }) => (
          <button
            key={text}
            type="button"
            onClick={() => onPrompt(text)}
            className="group w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-left
                       border border-white/[.06] bg-white/[.02]
                       hover:border-orange-500/30 hover:bg-orange-500/5
                       transition-all duration-150"
          >
            <span className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center bg-white/[.03]">
              <Icon className="w-3.5 h-3.5 text-zinc-600 group-hover:text-orange-400 transition-colors duration-150" />
            </span>
            <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors duration-150">
              {text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface IgnisAppProps {
  onToggleWorkbench?: () => void;
  workbenchOpen?: boolean;
}

export function IgnisApp({ onToggleWorkbench, workbenchOpen = false }: IgnisAppProps) {
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
    registerSessionId, registerAssistantConfirmationWriter,
    setActiveArtifact, open: openWorkbench,
  } = useWorkbench();

  // ── Wizard state ─────────────────────────────────────────────────────────
  // "text wizard" = triggered by detecting 3+ numbered steps in response text
  const [textWizard, setTextWizard] = useState<{
    title: string;
    steps: WizardStep[];
  } | null>(null);
  const [textWizardIdx, setTextWizardIdx] = useState(0);
  // Tracks message IDs whose wizard was explicitly dismissed — prevents re-trigger after Exit
  const dismissedMessageIds = useRef<Set<string>>(new Set());

  // Is the wizard overlay currently showing? Checklist artifacts stay localized
  // in the Workbench panel so chat layout does not jump during completion.
  const isWizardMode = textWizard !== null;

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
            // Do NOT apply spatial context mid-stream — defer to the finally block
            // so we can suppress it when a widget artifact is present in the same response.
            setMessages((current) =>
              updateAssistant(current, assistantId, (message) => {
                const streamText = stripStreamingTags(finalText);
                const pendingArtifact = streamText.pending;
                const textForParsing = streamText.clean;
                const finalArtifacts = parseArtifacts(textForParsing);
                const baseText = stripSpatialContext(stripArtifacts(textForParsing));
                const referenceImages = parseReferenceImages(baseText);
                const displayText = referenceImages.length > 0 ? stripReferenceImages(baseText) : baseText;

                return {
                  ...message,
                  text: finalText,
                  artifacts: finalArtifacts,
                  displayText,
                  referenceImages,
                  pendingArtifact,
                };
              })
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
        const hasWidget = finalArtifacts.some(a => a.type === 'widget');

        // Widget responses are self-contained — suppress spatial highlight so the
        // machine viewer doesn't open alongside the widget. For all other responses,
        // apply spatial context now (deferred from streaming to avoid premature opens).
        if (hasWidget) {
          setSpatialContext(null);
        } else {
          const spatial = parseSpatialContext(finalText);
          if (spatial) setSpatialContext(spatial);
        }

        const baseText = stripSpatialContext(stripArtifacts(finalText));
        const referenceImages = parseReferenceImages(baseText);
        const displayText = referenceImages.length > 0 ? stripReferenceImages(baseText) : baseText;

        setMessages((current) =>
          updateAssistant(current, assistantId, (message) => ({
            ...message,
            streaming: false,
            artifacts: finalArtifacts,
            spatialContext: hasWidget ? null : (parseSpatialContext(finalText) ?? message.spatialContext),
            displayText,
            referenceImages,
            pendingArtifact: null,
          }))
        );
        const checklist = finalArtifacts.find((a) => a.type === 'checklist');
        if (checklist) setActiveChecklist(checklist);

        // Route workbench-bound artifacts to the right panel.
        // Latest wins — if the agent re-emits the same id it replaces the previous canvas.
        const workbenchCandidates = finalArtifacts.filter((a) => WORKBENCH_ARTIFACT_TYPES.has(a.type));
        const workbenchArtifact = workbenchCandidates[workbenchCandidates.length - 1] ?? null;
        if (workbenchArtifact) {
          setActiveArtifact(workbenchArtifact);
          openWorkbench();
        }

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
    [isStreaming, setSpatialContext, setSessionState, addTurn, setActiveChecklist, setActiveArtifact, openWorkbench]
  );

  useEffect(() => {
    registerSendMessage(sendMessage);
  }, [registerSendMessage, sendMessage]);

  useEffect(() => {
    registerSessionId(sessionId.current);
  }, [registerSessionId]);

  useEffect(() => {
    registerAssistantConfirmationWriter((text) => {
      setMessages((current) => [
        ...current,
        {
          id: makeId('msg'),
          role: 'assistant',
          text,
          timestamp: nowLabel(),
        },
      ]);
      history.current = [...history.current, { role: 'assistant', content: text }];
    });
  }, [registerAssistantConfirmationWriter]);

  // ── Wizard handlers ───────────────────────────────────────────────────────

  const handleWizardNext = useCallback(() => {
    if (textWizard) {
      const isLast = textWizardIdx === textWizard.steps.length - 1;
      if (isLast) {
        const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) dismissedMessageIds.current.add(lastAssistant.id);
        setTextWizard(null);
        setTextWizardIdx(0);
      } else {
        setTextWizardIdx((i) => i + 1);
      }
    }
  }, [
    textWizard, textWizardIdx, messages,
  ]);

  const handleWizardExit = useCallback(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) dismissedMessageIds.current.add(lastAssistant.id);
    setTextWizard(null);
    setTextWizardIdx(0);
  }, [messages]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Wizard mode — full-screen step layout
  if (isWizardMode) {
    const title = textWizard?.title ?? 'Procedure';
    const steps = textWizard?.steps ?? [];

    return (
      <div className="flex h-full min-h-0 flex-col" style={{ backgroundColor: '#0f1114' }}>
        <WizardModeView
          title={title}
          steps={steps}
          currentStepIdx={textWizardIdx}
          onNext={handleWizardNext}
          onExit={handleWizardExit}
        />
      </div>
    );
  }

  // Normal chat mode
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ backgroundColor: '#0f1114' }}>
      <header
        className="flex-shrink-0 flex items-center justify-between px-4"
        style={{
          height: 48,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: '#0f1012',
          boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/ignis-logo.svg" alt="Ignis" className="h-5 w-auto flex-shrink-0" />
          <div className="w-px h-3.5 flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <span className="text-sm font-medium truncate" style={{ color: '#d4d8e4' }}>
            Vulcan OmniPro 220
          </span>
          <span className="text-[9px] font-mono hidden sm:block uppercase tracking-widest" style={{ color: '#2e3448' }}>
            · Assist
          </span>
        </div>
        {onToggleWorkbench && (
          <button
            onClick={onToggleWorkbench}
            title={workbenchOpen ? 'Close machine viewer' : 'Open machine viewer'}
            className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-mono uppercase tracking-wider transition-all duration-150 ${
              workbenchOpen
                ? 'border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/[.15]'
                : 'border-zinc-800/80 text-zinc-600 hover:border-zinc-700 hover:text-zinc-300'
            }`}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/>
              <line x1="6.5" y1="1.5" x2="6.5" y2="14.5"/>
            </svg>
            <span>{workbenchOpen ? 'Close' : 'View'}</span>
          </button>
        )}
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
      </main>
    </div>
  );
}

export default IgnisApp;

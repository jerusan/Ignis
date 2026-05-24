import React, { useCallback, useEffect, useState, useRef } from 'react';
import { SendIcon, WrenchIcon } from 'lucide-react';
import Message from '../Message';
import ToolCallChip from '../ToolCallChip';
import ArtifactRenderer from '../ArtifactRenderer';
import VoiceButton from '../VoiceButton';
import { InlineMachineVisual } from '../InlineMachineVisual';
import { ChatStepStepper } from '../ChatStepStepper';
import { AnnotatedImage } from '../AnnotatedImage';
import { WORKBENCH_ARTIFACT_TYPES } from '../../lib/artifacts';
import type {
  ChatArtifact,
  ChatToolCall,
  ChatMessage,
  ChatPaneProps,
  ReferenceImage,
  PendingArtifact,
} from '../../types/chat';

export type {
  ChatArtifact,
  ChatToolCall,
  ChatMessage,
  ChatPaneProps,
};



function ArtifactBuilding({ type, title }: PendingArtifact) {
  const label = title ? `Building ${title}` : type ? `Building ${type} artifact` : 'Building artifact';
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-background-muted animate-shimmer w-full shadow-[0_0_12px_rgba(255,107,0,0.15)] relative overflow-hidden">
      {type && type !== 'spatial' && (
        <span className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0 animate-pulse">
          {type}
        </span>
      )}
      <span className="text-sm text-foreground-muted truncate animate-pulse">{label}</span>
      <div className="ml-auto flex-shrink-0 flex items-center justify-center">
        <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
  );
}

function ChatPane({
  messages,
  onSend,
  voiceState = 'idle',
  onVoiceToggle,
  offline = false,
  placeholder = 'Ask about your Vulcan OmniPro 220…',
  disabled = false,
  emptyState,
  onWorkbenchToggle,
  workbenchOpen = false,
}: ChatPaneProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prevLength = prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (prevLength === 0) {
      el.scrollTop = el.scrollHeight;
    } else if (messages.length > prevLength) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else if (messages.some(m => m.streaming)) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || disabled) return;
      onSend?.(text);
      setInput('');
    },
    [input, onSend, disabled],
  );

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Determine the index of the last assistant message that has a spatialContext.
  // That message gets the full expanded visual; all prior ones show as thumbnails.
  const lastSpatialIdx = messages.reduce<number>((acc, m, i) => {
    return m.role === 'assistant' && m.spatialContext ? i : acc;
  }, -1);

  // Count of spatial messages for step label generation
  const spatialMessages = messages.filter(
    m => m.role === 'assistant' && m.spatialContext,
  );

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {offline && (
        <div
          className="flex items-center gap-2 px-4 py-2 bg-warning/15 text-warning border-b border-warning/30"
          role="status"
        >
          <span className="text-xs font-medium">
            Offline — specs and diagnostic graph available, live agent paused.
          </span>
        </div>
      )}

      {/* ── Step progress stepper (visible when a checklist is active) ──── */}
      <ChatStepStepper />

      {/* ── Message feed ─────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            {emptyState ?? (
              <div className="max-w-md space-y-2">
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  Ignis
                </h2>
                <p className="text-sm text-foreground-muted">
                  Multimodal assistant for the Vulcan OmniPro 220. Ask about
                  duty cycles, polarity, or describe a defect — I'll walk you
                  through it.
                </p>
              </div>
            )}
          </div>
        ) : (
          messages.map((m, msgIdx) => {
            const pendingArtifact = m.pendingArtifact ?? null;
            const artifacts = m.artifacts ?? [];
            const referenceImages = m.referenceImages ?? [];
            const displayText = m.displayText ?? m.text;

            // Determine step label for this spatial message (e.g. "Step 2 of 4")
            const isCurrentStep = msgIdx === lastSpatialIdx;
            const spatialStepIdx = m.spatialContext
              ? spatialMessages.findIndex(
                  sm => sm.spatialContext === m.spatialContext,
                )
              : -1;
            const stepLabel =
              m.spatialContext && spatialMessages.length > 1
                ? `Step ${spatialStepIdx + 1} of ${spatialMessages.length}`
                : undefined;

            return (
              <div key={m.id} className="space-y-2 animate-fade-in">
                <Message
                  role={m.role}
                  text={m.text}
                  displayText={displayText}
                  streaming={m.streaming}
                  timestamp={m.timestamp}
                  referenceImages={referenceImages}
                />

                {/* Tool call chips */}
                {m.role === 'assistant' &&
                  m.toolCalls &&
                  m.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-11">
                      {m.toolCalls.map(tc => (
                        <ToolCallChip
                          key={tc.id}
                          tool={tc.tool}
                          status={tc.status}
                          input={tc.input}
                          result={tc.result}
                        />
                      ))}
                    </div>
                  )}

                {/* ── Inline machine visual (replaces CollapsibleSpatial) ── */}
                {m.role === 'assistant' && m.spatialContext && (
                  <div className="pl-11">
                    <InlineMachineVisual
                      spatialContext={m.spatialContext}
                      isCurrentStep={isCurrentStep}
                      stepLabel={stepLabel}
                      onNextStep={
                        isCurrentStep
                          ? () =>
                              onSend?.(
                                "Done with this step, please continue to the next one.",
                              )
                          : undefined
                      }
                    />
                  </div>
                )}

                {/* Building animation — shown while the artifact tag is still streaming */}
                {m.role === 'assistant' && pendingArtifact && (
                  <div className="pl-11">
                    <ArtifactBuilding {...pendingArtifact} />
                  </div>
                )}

                {/* Artifacts — workbench-bound types render as chips; markdown renders inline */}
                {m.role === 'assistant' && artifacts.length > 0 && (
                  <div className="pl-11 space-y-3">
                    {artifacts.map(a => (
                      <ArtifactRenderer
                        key={a.id}
                        id={a.id}
                        type={a.type}
                        title={a.title}
                        code={a.code}
                        source_pages={a.source_pages}
                        widgetName={a.widgetName}
                        compact={WORKBENCH_ARTIFACT_TYPES.has(a.type)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Input form ───────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-background-subtle bg-background p-3"
      >
        <div className="flex items-end gap-2">
          {onVoiceToggle && (
            <VoiceButton state={voiceState} onClick={onVoiceToggle} size="md" />
          )}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="Message Ignis"
            className="flex-1 resize-none rounded-md border border-white/[.15] bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary disabled:bg-background-muted disabled:cursor-not-allowed min-h-[40px] max-h-32 transition-colors"
          />
          {onWorkbenchToggle && (
            <button
              type="button"
              onClick={onWorkbenchToggle}
              aria-label={workbenchOpen ? 'Close workbench' : 'Open workbench'}
              className={`w-9 h-9 flex-shrink-0 rounded-md border flex items-center justify-center transition-all duration-150 ${
                workbenchOpen
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-white/[.15] bg-secondary text-foreground-subtle hover:text-foreground hover:border-white/30'
              }`}
            >
              <WrenchIcon className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            aria-label="Send message"
            className="w-10 h-10 flex-shrink-0 rounded-md bg-primary text-white flex items-center justify-center hover:bg-primary-hover disabled:bg-background-subtle disabled:text-foreground-subtle disabled:cursor-not-allowed transition-colors"
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatPane;

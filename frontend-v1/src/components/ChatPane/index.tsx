import React, { useCallback, useEffect, useState, useRef } from 'react';
import { SendIcon, WifiOffIcon, BookOpenIcon, ChevronDownIcon, WrenchIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Message from '../Message';
import ToolCallChip, { ToolName, ToolStatus } from '../ToolCallChip';
import ArtifactRenderer, { ArtifactType } from '../ArtifactRenderer';
import VoiceButton, { VoiceState } from '../VoiceButton';
import { InlineMachineVisual } from '../InlineMachineVisual';
import { ChatStepStepper } from '../ChatStepStepper';
import { AnnotatedImage } from '../AnnotatedImage';
import {
  parseArtifacts,
  stripArtifacts,
  stripSpatialContext,
  stripStreamingTags,
  parseReferenceImages,
  stripReferenceImages,
  WORKBENCH_ARTIFACT_TYPES,
  type ReferenceImage,
  type SpatialContextTag,
  type PendingArtifact,
} from '../../lib/artifacts';

export interface ChatArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  code: string;
  mode?: 'replace';
  source_pages?: string;
}
export interface ChatToolCall {
  id: string;
  tool: ToolName;
  status: ToolStatus;
  input?: Record<string, unknown>;
  result?: string;
}
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  toolCalls?: ChatToolCall[];
  artifacts?: ChatArtifact[];
  timestamp?: string;
  spatialContext?: SpatialContextTag;
}
export interface ChatPaneProps {
  messages: ChatMessage[];
  onSend?: (text: string) => void;
  voiceState?: VoiceState;
  onVoiceToggle?: () => void;
  offline?: boolean;
  placeholder?: string;
  disabled?: boolean;
  emptyState?: React.ReactNode;
  onWorkbenchToggle?: () => void;
  workbenchOpen?: boolean;
}

function ReferenceImages({ images }: { images: ReferenceImage[] }) {
  const [expanded, setExpanded] = useState(false);
  if (images.length === 0) return null;
  return (
    <div className="pl-11 mt-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors py-1"
        aria-expanded={expanded}
      >
        <BookOpenIcon className="w-3.5 h-3.5" />
        <span>References</span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="mt-2 space-y-3 border-l-2 border-background-subtle pl-3">
          {images.map((img, i) => (
            <figure key={i} className="space-y-1">
              <AnnotatedImage src={img.url} alt={img.alt} bounds={img.bounds} />
              {img.alt && (
                <figcaption className="text-xs text-foreground-muted">{img.alt}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function ArtifactBuilding({ type, title }: PendingArtifact) {
  const label = title ? `Building ${title}` : type ? `Building ${type} artifact` : 'Building artifact';
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-lg border border-background-subtle bg-background-muted w-full">
      {type && type !== 'spatial' && (
        <span className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0">
          {type}
        </span>
      )}
      <span className="text-sm text-foreground-muted truncate">{label}</span>
      <div className="flex gap-1 ml-auto flex-shrink-0">
        {[0, 150, 300].map(delay => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
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

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
            // During streaming, strip any partial/incomplete special tags and
            // capture metadata so we can show a building animation in their place.
            const streamText =
              m.streaming && m.role === 'assistant'
                ? stripStreamingTags(m.text)
                : null;
            const pendingArtifact = streamText?.pending ?? null;
            const textForParsing = streamText?.clean ?? m.text;

            const parsedArtifacts =
              m.role === 'assistant' ? parseArtifacts(textForParsing) : [];
            const artifacts =
              m.artifacts && m.artifacts.length > 0
                ? m.artifacts
                : parsedArtifacts;

            const baseText =
              m.role === 'assistant'
                ? stripSpatialContext(stripArtifacts(textForParsing))
                : m.text;
            const referenceImages =
              m.role === 'assistant' && artifacts.length > 0
                ? parseReferenceImages(baseText)
                : [];
            const displayText =
              referenceImages.length > 0
                ? stripReferenceImages(baseText)
                : baseText;

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
              <div key={m.id} className="space-y-2">
                <Message
                  role={m.role}
                  streaming={m.streaming}
                  timestamp={m.timestamp}
                >
                  {m.role === 'assistant' ? (
                    displayText ? (
                      <div className="prose-ignis">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {displayText}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-foreground-subtle py-1">
                        <span className="text-sm font-medium">Working</span>
                        <div className="flex gap-1">
                          <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )
                  ) : (
                    m.text
                  )}
                </Message>

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
                        compact={WORKBENCH_ARTIFACT_TYPES.has(a.type)}
                      />
                    ))}
                  </div>
                )}

                {/* Reference images */}
                {m.role === 'assistant' && referenceImages.length > 0 && (
                  <ReferenceImages images={referenceImages} />
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

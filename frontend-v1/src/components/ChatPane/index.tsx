import React, { useCallback, useEffect, useState, useRef } from 'react';
import { SendIcon, WifiOffIcon, ChevronDownIcon, BookOpenIcon, ZapIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Message from '../Message';
import ToolCallChip, { ToolName, ToolStatus } from '../ToolCallChip';
import ArtifactRenderer, { ArtifactType } from '../ArtifactRenderer';
import VoiceButton, { VoiceState } from '../VoiceButton';
import { SpatialViewport, REGISTRY_BY_VIEW } from '../SpatialViewport';
import { AnnotatedImage } from '../AnnotatedImage';
import {
  parseArtifacts,
  stripArtifacts,
  stripSpatialContext,
  parseReferenceImages,
  stripReferenceImages,
  type ReferenceImage,
  type SpatialContextTag,
} from '../../lib/artifacts';
export interface ChatArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  code: string;
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

function CollapsibleSpatial({ spatialContext }: { spatialContext: SpatialContextTag }) {
  const [expanded, setExpanded] = useState(false);
  const registry = REGISTRY_BY_VIEW[spatialContext.view];
  const count = spatialContext.highlights.length;

  return (
    <div className="pl-11 mt-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors py-1"
        aria-expanded={expanded}
      >
        <ZapIcon className="w-3.5 h-3.5" />
        <span>
          {count > 0
            ? `${count} part${count !== 1 ? 's' : ''} highlighted`
            : 'View diagram'}
        </span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="mt-2 max-w-xs rounded-lg overflow-hidden border border-background-subtle">
          <SpatialViewport
            currentView={spatialContext.view}
            registry={registry}
            highlightedComponents={spatialContext.highlights}
            drawPath={spatialContext.draw_path}
            transparent
          />
        </div>
      )}
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
  emptyState
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
    [input, onSend, disabled]
  );
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  return (
    <div className="flex flex-col h-full w-full bg-background">
      {offline &&
      <div
        className="flex items-center gap-2 px-4 py-2 bg-warning/15 text-warning border-b border-warning/30"
        role="status">
        
          <WifiOffIcon className="w-4 h-4" />
          <span className="text-xs font-medium">
            Offline — specs and diagnostic graph available, live agent paused.
          </span>
        </div>
      }

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
        role="log"
        aria-live="polite">
        
        {messages.length === 0 ?
        <div className="h-full flex items-center justify-center text-center">
            {emptyState ??
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
          }
          </div> :

        messages.map((m) => {
          const parsedArtifacts =
          m.role === 'assistant' ? parseArtifacts(m.text) : [];
          const artifacts =
          m.artifacts && m.artifacts.length > 0 ?
          m.artifacts :
          parsedArtifacts;

          // When artifacts are present, lift inline images to the References section
          const baseText =
            m.role === 'assistant' ? stripSpatialContext(stripArtifacts(m.text)) : m.text;
          const referenceImages =
            m.role === 'assistant' && artifacts.length > 0
              ? parseReferenceImages(baseText)
              : [];
          const displayText =
            referenceImages.length > 0 ? stripReferenceImages(baseText) : baseText;

          return (
        <div key={m.id} className="space-y-2">
              <Message
            role={m.role}
            streaming={m.streaming}
            timestamp={m.timestamp}>
            
                {m.role === 'assistant' ?
            displayText ?
            <div className="prose-ignis">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {displayText}
                      </ReactMarkdown>
                    </div> :
            <span className="text-foreground-subtle">Working...</span> :

            m.text
            }
              </Message>

              {m.role === 'assistant' &&
          m.toolCalls &&
          m.toolCalls.length > 0 &&
          <div className="flex flex-wrap gap-2 pl-11">
                    {m.toolCalls.map((tc) =>
            <ToolCallChip
              key={tc.id}
              tool={tc.tool}
              status={tc.status}
              input={tc.input}
              result={tc.result} />

            )}
                  </div>
          }

              {m.role === 'assistant' && m.spatialContext && (
                <CollapsibleSpatial spatialContext={m.spatialContext} />
              )}

              {m.role === 'assistant' &&
          artifacts.length > 0 &&
          <div className="pl-11 space-y-3">
                    {artifacts.map((a) =>
            <ArtifactRenderer
              key={a.id}
              id={a.id}
              type={a.type}
              title={a.title}
              code={a.code} />

            )}
                  </div>
          }

              {m.role === 'assistant' && referenceImages.length > 0 &&
          <ReferenceImages images={referenceImages} />
          }
            </div>
          );
        })
        }
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-background-subtle bg-background p-3">
        
        <div className="flex items-end gap-2">
          {onVoiceToggle &&
          <VoiceButton state={voiceState} onClick={onVoiceToggle} size="md" />
          }
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="Message Ignis"
            className="flex-1 resize-none rounded-md border border-background-subtle bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:bg-background-muted disabled:cursor-not-allowed min-h-[40px] max-h-32" />
          
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            aria-label="Send message"
            className="w-10 h-10 flex-shrink-0 rounded-md bg-primary text-white flex items-center justify-center hover:bg-primary-hover disabled:bg-background-subtle disabled:text-foreground-subtle disabled:cursor-not-allowed transition-colors">
            
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>);

}
export default ChatPane;

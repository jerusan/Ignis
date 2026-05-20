import React, { useCallback, useEffect, useState, useRef } from 'react';
import { SendIcon, WifiOffIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Message from '../Message';
import ToolCallChip, { ToolName, ToolStatus } from '../ToolCallChip';
import ArtifactRenderer, { ArtifactType } from '../ArtifactRenderer';
import VoiceButton, { VoiceState } from '../VoiceButton';
import { parseArtifacts, stripArtifacts } from '../../lib/artifacts';
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
          const displayText =
          m.role === 'assistant' ? stripArtifacts(m.text) : m.text;

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

              {m.role === 'assistant' &&
          artifacts.length > 0 &&
          <div className="pl-11 space-y-3">
                    {artifacts.map((a) =>
            <ArtifactRenderer
              key={a.id}
              type={a.type}
              title={a.title}
              code={a.code} />

            )}
                  </div>
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

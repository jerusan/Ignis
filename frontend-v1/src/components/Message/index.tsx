import React, { useState } from 'react';
import { UserIcon, SparklesIcon, BookOpenIcon, ChevronDownIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnnotatedImage } from '../AnnotatedImage';
import type { ReferenceImage } from '../../types/chat';

export type MessageRole = 'user' | 'assistant';

export interface MessageProps {
  role: MessageRole;
  text?: string;
  displayText?: string;
  streaming?: boolean;
  timestamp?: string;
  referenceImages?: ReferenceImage[];
}

function ReferenceImages({ images }: { images: ReferenceImage[] }) {
  const [expanded, setExpanded] = useState(false);
  if (images.length === 0) return null;
  return (
    <div className="mt-2 pt-2 border-t border-white/[0.04]">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors py-1 px-2 rounded bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] shadow-sm cursor-pointer"
        aria-expanded={expanded}
      >
        <BookOpenIcon className="w-3.5 h-3.5 text-primary/80" />
        <span>References</span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="mt-2 space-y-3 border-l border-white/[0.1] pl-3">
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

function MessageComponent({
  role,
  text = '',
  displayText = '',
  streaming = false,
  timestamp,
  referenceImages = []
}: MessageProps) {
  const isUser = role === 'user';
  return (
    <div
      className={`flex gap-3 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      role="article"
      aria-label={`${role} message`}>
      
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-background-subtle text-foreground-muted' : 'bg-primary text-white'}`}
        aria-hidden="true">
        
        {isUser ?
        <UserIcon className="w-4 h-4" /> :

        <SparklesIcon className="w-4 h-4" />
        }
      </div>
      <div
        className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        
        <div
          className={`px-4 py-3 rounded-lg text-sm leading-relaxed ${isUser ? 'bg-primary text-white rounded-tr-sm' : 'bg-background-muted text-foreground rounded-tl-sm'}`}>
          
          {isUser ? (
            text
          ) : (
            <div className="space-y-2">
              {displayText ? (
                <div className={`prose-ignis ${streaming ? 'is-streaming' : ''}`}>
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
              )}
              {referenceImages.length > 0 && (
                <ReferenceImages images={referenceImages} />
              )}
            </div>
          )}
        </div>
        {timestamp &&
        <span className="text-xs text-foreground-subtle px-1">
            {timestamp}
          </span>
        }
      </div>
    </div>);
}

export const Message = React.memo(MessageComponent, (prev, next) => {
  return (
    prev.role === next.role &&
    prev.text === next.text &&
    prev.displayText === next.displayText &&
    prev.streaming === next.streaming &&
    prev.timestamp === next.timestamp &&
    JSON.stringify(prev.referenceImages) === JSON.stringify(next.referenceImages)
  );
});

export default Message;
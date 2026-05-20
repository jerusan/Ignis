import React from 'react';
import { UserIcon, SparklesIcon } from 'lucide-react';
export type MessageRole = 'user' | 'assistant';
export interface MessageProps {
  role: MessageRole;
  children: React.ReactNode;
  streaming?: boolean;
  timestamp?: string;
}
function Message({
  role,
  children,
  streaming = false,
  timestamp
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
          
          {children}
          {streaming &&
          <span
            className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-current animate-pulse"
            aria-label="streaming" />

          }
        </div>
        {timestamp &&
        <span className="text-xs text-foreground-subtle px-1">
            {timestamp}
          </span>
        }
      </div>
    </div>);

}
export default Message;
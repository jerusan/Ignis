import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import ArtifactRenderer from "./ArtifactRenderer";
import VoiceButton from "./VoiceButton";
import { parseArtifacts, stripArtifacts } from "../lib/artifact-schema";
import type { TurnStats } from "./DebugPanel";

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: ToolCall[];
}

interface Props {
  onTurnComplete: (stats: TurnStats) => void;
}

const TOOL_LABELS: Record<string, string> = {
  get_machine_spec: "Checking specs",
  diagnose_defect: "Running diagnostic",
  get_visual: "Fetching diagram",
  search_manual: "Searching manual",
};

function ToolChip({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[tool.name] ?? tool.name;
  return (
    <div className="inline-flex flex-col gap-1 my-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full
                   bg-amber-950/60 text-amber-400 border border-amber-900/50
                   hover:bg-amber-900/60 transition-colors"
      >
        <span>⚙</span>
        <span>{label}</span>
        <span className="text-amber-600">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <pre className="text-xs bg-zinc-900 text-zinc-400 px-3 py-2 rounded-lg
                        border border-zinc-800 overflow-x-auto max-w-md">
          {JSON.stringify(tool.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const artifacts = parseArtifacts(msg.text);
  const displayText = stripArtifacts(msg.text);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-sm
                        bg-orange-600/20 border border-orange-600/30 text-zinc-100 text-sm">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {msg.tools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {msg.tools.map((t, i) => (
            <ToolChip key={i} tool={t} />
          ))}
        </div>
      )}
      {displayText && (
        <div className="prose-chat">
          <ReactMarkdown>{displayText}</ReactMarkdown>
        </div>
      )}
      {artifacts.map((a, i) => (
        <ArtifactRenderer key={i} artifact={a} />
      ))}
    </div>
  );
}

export default function ChatPane({ onTurnComplete }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // conversation history for the API (role + content only)
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const sessionId = useRef(crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isStreaming) return;
      setInput("");

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: userText.trim(),
        tools: [],
      };
      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        tools: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      historyRef.current.push({ role: "user", content: userText.trim() });

      setIsStreaming(true);
      const turnStart = Date.now();
      let finalText = "";
      const toolsCalled: string[] = [];

      try {
        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyRef.current,
            session_id: sessionId.current,
          }),
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (event.type === "text_delta") {
              finalText += event.text as string;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: finalText } : m
                )
              );
            } else if (event.type === "tool_use") {
              const toolName = event.name as string;
              toolsCalled.push(toolName);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        tools: [
                          ...m.tools,
                          {
                            name: toolName,
                            input: event.input as Record<string, unknown>,
                          },
                        ],
                      }
                    : m
                )
              );
            } else if (event.type === "done") {
              onTurnComplete({
                latency_ms: Date.now() - turnStart,
                input_tokens: event.input_tokens as number,
                output_tokens: event.output_tokens as number,
                tools_called: toolsCalled,
              });
            }
          }
        }
      } catch (err) {
        finalText = `Error: ${err instanceof Error ? err.message : String(err)}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: finalText } : m
          )
        );
      } finally {
        historyRef.current.push({ role: "assistant", content: finalText });
        setIsStreaming(false);
      }
    },
    [isStreaming, onTurnComplete]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setInput((prev) => (prev ? prev + " " + text : text));
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      {isOffline && (
        <div className="px-4 py-2 text-xs text-center bg-amber-900/40 text-amber-400 border-b border-amber-900/50">
          You are offline — specs and diagnostics may be unavailable
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-5xl">🔥</div>
            <p className="text-zinc-400 text-sm max-w-xs">
              Ask anything about your Vulcan OmniPro 220 — duty cycles, polarity
              setup, troubleshooting, wire feed issues.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-950">
        <div className="flex items-end gap-2">
          <VoiceButton
            onTranscript={handleVoiceTranscript}
            disabled={isStreaming}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your welder…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm
                       bg-zinc-800 border border-zinc-700 text-zinc-100
                       placeholder:text-zinc-500
                       focus:outline-none focus:border-orange-500/60
                       disabled:opacity-50 disabled:cursor-not-allowed
                       max-h-40 overflow-y-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={() => submit(input)}
            disabled={isStreaming || !input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-600
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center text-white transition-colors"
          >
            {isStreaming ? (
              <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin block" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-zinc-600 pl-11">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

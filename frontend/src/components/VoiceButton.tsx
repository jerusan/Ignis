import { useRef, useState } from "react";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

type VoiceState = "idle" | "recording" | "processing";

const DG_KEY = import.meta.env.VITE_DEEPGRAM_KEY;

export default function VoiceButton({ onTranscript, disabled }: Props) {
  const [state, setState] = useState<VoiceState>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const start = async () => {
    if (!DG_KEY) {
      alert("VITE_DEEPGRAM_KEY is not set — voice input unavailable.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ws = new WebSocket(
        "wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&smart_format=true",
        ["token", DG_KEY]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        recorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (ws.readyState === WebSocket.OPEN && e.data.size > 0) {
            ws.send(e.data);
          }
        };
        recorder.start(250);
        setState("recording");
      };

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const transcript = data?.channel?.alternatives?.[0]?.transcript;
        if (transcript && data.is_final) {
          onTranscript(transcript);
        }
      };

      ws.onerror = () => stop();
      ws.onclose = () => setState("idle");
    } catch {
      setState("idle");
    }
  };

  const stop = () => {
    setState("processing");
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setTimeout(() => setState("idle"), 400);
  };

  const toggle = () => (state === "recording" ? stop() : start());

  const label =
    state === "recording" ? "Stop" : state === "processing" ? "…" : "🎙";

  return (
    <button
      onClick={toggle}
      disabled={disabled || state === "processing"}
      title={DG_KEY ? "Voice input" : "Voice input (VITE_DEEPGRAM_KEY not set)"}
      className={[
        "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all",
        state === "recording"
          ? "bg-red-500 hover:bg-red-600 animate-pulse text-white"
          : state === "processing"
          ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

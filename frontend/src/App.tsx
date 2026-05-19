import { useState } from "react";
import ChatPane from "./components/ChatPane";
import DebugPanel from "./components/DebugPanel";
import type { TurnStats } from "./components/DebugPanel";

export default function App() {
  const [lastStats, setLastStats] = useState<TurnStats | null>(null);

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center gap-3 px-5 py-3
                          bg-zinc-900 border-b border-zinc-800">
        <span className="text-xl">🔥</span>
        <div>
          <h1 className="text-sm font-semibold text-zinc-100 leading-tight">Ignis</h1>
          <p className="text-xs text-zinc-500 leading-tight">Vulcan OmniPro 220</p>
        </div>
      </header>

      {/* Chat */}
      <main className="flex-1 overflow-hidden">
        <ChatPane onTurnComplete={setLastStats} />
      </main>

      {/* Debug panel */}
      <DebugPanel stats={lastStats} />
    </div>
  );
}

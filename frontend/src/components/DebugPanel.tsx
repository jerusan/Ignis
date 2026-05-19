import { useState } from "react";

export interface TurnStats {
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  tools_called: string[];
}

interface Props {
  stats: TurnStats | null;
}

// claude-sonnet-4-20250514 pricing
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

export default function DebugPanel({ stats }: Props) {
  const [open, setOpen] = useState(false);

  const cost = stats
    ? (stats.input_tokens * INPUT_COST_PER_TOKEN +
        stats.output_tokens * OUTPUT_COST_PER_TOKEN)
    : 0;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        <span className="font-mono">debug</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 text-xs font-mono text-zinc-400 space-y-1">
          {stats ? (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <span className="text-zinc-600">latency</span>
                <span>{(stats.latency_ms / 1000).toFixed(1)}s</span>
                <span className="text-zinc-600">input tokens</span>
                <span>{stats.input_tokens.toLocaleString()}</span>
                <span className="text-zinc-600">output tokens</span>
                <span>{stats.output_tokens.toLocaleString()}</span>
                <span className="text-zinc-600">est. cost</span>
                <span className="text-orange-400">${cost.toFixed(4)}</span>
                <span className="text-zinc-600">tools</span>
                <span className="text-zinc-300">
                  {stats.tools_called.length
                    ? stats.tools_called.join(", ")
                    : "none"}
                </span>
              </div>
            </>
          ) : (
            <span className="text-zinc-600">no turn yet</span>
          )}
        </div>
      )}
    </div>
  );
}

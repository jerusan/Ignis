// frontend/src/components/ChecklistRenderer/index.tsx
//
// Task-Centric Pane controller. Renders a vertical accordion-wizard where:
//   - Pending steps are collapsed and dimmed
//   - The active (first uncompleted) step is expanded with amber highlight
//   - Completed steps show a green check and collapse
//   - When all done the panel transitions to a "Machine Ready" summary
//
import { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { ChecklistStep } from '../../lib/artifacts';
import { silentChecklistStep } from '../../lib/chatApi';
import { useWorkbench } from '../WorkbenchOverlay';

interface Props {
  id?: string;
  title: string;
  code: string;
}

function SpatialBadge({ step }: { step: ChecklistStep }) {
  if (!step.spatial) return null;
  const { view, highlights } = step.spatial;
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/20 mt-1.5">
      <span className="opacity-60">{view}</span>
      <span className="opacity-30">·</span>
      {highlights.slice(0, 2).map(h => (
        <span key={h}>{h.replace(/_/g, ' ')}</span>
      ))}
      {highlights.length > 2 && <span className="opacity-50">+{highlights.length - 2}</span>}
    </span>
  );
}

export default function ChecklistRenderer({ title, code }: Props) {
  const { setSpatialContext, sessionId, setActiveChecklist } = useWorkbench();

  const [steps, setSteps]         = useState<ChecklistStep[]>([]);
  const [parseError, setParseError] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(code);
      if (Array.isArray(parsed)) {
        const list = parsed as ChecklistStep[];
        setSteps(list);
        const first = list[0];
        if (first?.spatial) {
          setSpatialContext({
            view: first.spatial.view,
            highlights: first.spatial.highlights,
            draw_path: first.spatial.draw_path,
          });
        }
      } else {
        setParseError(true);
      }
    } catch {
      setParseError(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleComplete = useCallback((step: ChecklistStep) => {
    setCompleted(prev => {
      const next = new Set(prev);
      next.add(step.id);
      const nextStep = steps.find(s => !next.has(s.id));
      if (nextStep?.spatial) {
        setSpatialContext({
          view: nextStep.spatial.view,
          highlights: nextStep.spatial.highlights,
          draw_path: nextStep.spatial.draw_path,
        });
      } else {
        setSpatialContext(null);
      }
      return next;
    });
    silentChecklistStep(sessionId, step.id, step.text);
  }, [steps, setSpatialContext, sessionId]);

  const handleReset = useCallback(() => {
    setCompleted(new Set());
    const first = steps[0];
    if (first?.spatial) {
      setSpatialContext({
        view: first.spatial.view,
        highlights: first.spatial.highlights,
        draw_path: first.spatial.draw_path,
      });
    } else {
      setSpatialContext(null);
    }
  }, [steps, setSpatialContext]);

  if (parseError) {
    return (
      <div className="px-3 py-2 text-xs text-red-400 font-mono">
        Invalid checklist format — expected a JSON array.
      </div>
    );
  }

  const completedCount = completed.size;
  const total          = steps.length;
  const allDone        = completedCount === total && total > 0;
  const progress       = total > 0 ? (completedCount / total) * 100 : 0;
  const activeStepId   = steps.find(s => !completed.has(s.id))?.id ?? null;

  // ── Machine Ready summary ────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
          <CheckCircle2 className="h-7 w-7 text-green-500" />
        </div>
        <p className="text-sm font-bold tracking-tight" style={{ color: '#e6e9ef' }}>
          Machine Ready
        </p>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: '#5c6478' }}>
          {title} setup complete. All parameters confirmed.
        </p>
        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset Setup
          </button>
          <button
            onClick={() => setActiveChecklist(null)}
            className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // ── Active wizard ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-3 py-2"
        style={{
          backgroundColor: '#141418',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400 animate-pulse" />
          <span
            className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] flex-shrink-0"
            style={{ color: 'rgba(251,191,36,0.85)' }}
          >
            Setup
          </span>
          <span
            className="text-xs font-medium truncate"
            style={{ color: '#d4d8e4' }}
          >
            {title}
          </span>
        </div>
        <span className="flex-shrink-0 text-[10px] font-mono tabular-nums" style={{ color: '#3d4760' }}>
          {completedCount}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-px bg-zinc-800">
        <div
          className="h-full bg-amber-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step cards */}
      <div className="px-2 py-2 space-y-1.5">
        {steps.map((step, i) => {
          const isDone    = completed.has(step.id);
          const isActive  = step.id === activeStepId;

          return (
            <div
              key={step.id}
              className={`rounded-lg border transition-all duration-300 ${
                isDone
                  ? 'border-green-500/20 bg-green-500/[0.025] opacity-75 hover:border-green-500/40 cursor-pointer'
                  : isActive
                  ? 'border-amber-500/50 bg-amber-500/[0.05]'
                  : 'border-zinc-800/50 bg-zinc-900/20 opacity-40 hover:border-zinc-700/60 cursor-pointer'
              }`}
              style={isActive ? {
                boxShadow: '0 0 16px rgba(245,158,11,0.08)',
              } : undefined}
              onClick={() => {
                if (step.spatial) {
                  setSpatialContext({
                    view: step.spatial.view,
                    highlights: step.spatial.highlights,
                    draw_path: step.spatial.draw_path,
                  });
                }
              }}
            >
              <div className="flex items-start gap-3 px-3 py-3">

                {/* Status indicator */}
                <div className="mt-0.5 flex-shrink-0">
                  {isDone ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-green-500/40 bg-green-500/10">
                      <svg
                        className="h-2.5 w-2.5 text-green-500"
                        viewBox="0 0 10 10" fill="none"
                        stroke="currentColor" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round"
                      >
                        <polyline points="1.5,5 4,7.5 8.5,2" />
                      </svg>
                    </div>
                  ) : isActive ? (
                    <div className="h-5 w-5 rounded-full border-2 border-amber-500 animate-pulse" />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700">
                      <span className="text-[8px] font-mono text-zinc-600">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium leading-snug ${
                    isDone
                      ? 'text-zinc-500'
                      : isActive
                      ? 'text-zinc-100'
                      : 'text-zinc-500'
                  }`}>
                    {step.text}
                  </p>

                  {isActive && step.detail && (
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: '#5c6478' }}>
                      {step.detail}
                    </p>
                  )}

                  {isActive && <SpatialBadge step={step} />}

                  {isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplete(step);
                      }}
                      className="mt-3 w-full rounded border border-amber-500/40 bg-amber-500/10 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400 transition-all duration-150 hover:bg-amber-500/20 hover:border-amber-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// frontend/src/components/ChecklistRenderer/index.tsx
//
// Renders a stateful interactive diagnostic checklist from a JSON artifact.
// Each step can:
//   - Be hovered to preview its spatial context in the LeftZone viewport
//   - Be checked to mark it done, advance the viewport, and send a
//     completion message back to the agent
//
import { useState, useCallback, useEffect } from 'react';
import type { ChecklistStep } from '../../lib/artifacts';
import { silentChecklistStep } from '../../lib/chatApi';
import { useWorkbench } from '../WorkbenchOverlay';

interface Props {
  id?: string;
  title: string;
  code: string; // raw JSON string containing ChecklistStep[]
}

function StepSpatialBadge({ step }: { step: ChecklistStep }) {
  if (!step.spatial) return null;
  const { view, highlights, draw_path } = step.spatial;
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/20 mt-1">
      {draw_path && (
        <svg className="w-2 h-2 flex-shrink-0" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 7 L7 1" strokeDasharray="2 1" />
        </svg>
      )}
      <span className="opacity-60">{view}</span>
      <span className="opacity-30">·</span>
      {highlights.slice(0, 2).map(h => (
        <span key={h} className="opacity-80">{h.replace(/_/g, ' ')}</span>
      ))}
      {highlights.length > 2 && <span className="opacity-50">+{highlights.length - 2}</span>}
    </span>
  );
}

export default function ChecklistRenderer({ title, code }: Props) {
  const { setSpatialContext, sessionId } = useWorkbench();

  const [steps, setSteps]       = useState<ChecklistStep[]>([]);
  const [parseError, setParseError] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // Track the most recently auto-focused step (for ring highlight)
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(code);
      if (Array.isArray(parsed)) {
        setSteps(parsed as ChecklistStep[]);
        // Auto-focus the first step's spatial context
        const first = (parsed as ChecklistStep[])[0];
        if (first?.spatial) {
          setSpatialContext({
            view: first.spatial.view,
            highlights: first.spatial.highlights,
            draw_path: first.spatial.draw_path,
          });
          setFocusedId(first.id);
        }
      } else {
        setParseError(true);
      }
    } catch {
      setParseError(true);
    }
  // Only run on mount / code change — not when setSpatialContext ref changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Preview a step's spatial context on hover
  const handleHover = useCallback((step: ChecklistStep) => {
    if (!step.spatial) return;
    setSpatialContext({
      view: step.spatial.view,
      highlights: step.spatial.highlights,
      draw_path: step.spatial.draw_path,
    });
    setFocusedId(step.id);
  }, [setSpatialContext]);

  // Check a step: mark done, advance spatial to next step, send completion event
  const handleCheck = useCallback((step: ChecklistStep) => {
    setCompleted(prev => {
      const next = new Set(prev);
      next.add(step.id);

      // Find the first step that isn't in the new completed set
      const nextStep = steps.find(s => !next.has(s.id));
      if (nextStep) {
        if (nextStep.spatial) {
          setSpatialContext({
            view: nextStep.spatial.view,
            highlights: nextStep.spatial.highlights,
            draw_path: nextStep.spatial.draw_path,
          });
        }
        setFocusedId(nextStep.id);
      } else {
        // All steps done
        setSpatialContext(null);
        setFocusedId(null);
      }

      return next;
    });

    silentChecklistStep(sessionId, step.id, step.text);
  }, [steps, setSpatialContext, sessionId]);

  // Uncheck a step: local reset only, revert spatial to that step
  const handleUncheck = useCallback((step: ChecklistStep) => {
    setCompleted(prev => {
      const next = new Set(prev);
      next.delete(step.id);
      return next;
    });
    if (step.spatial) {
      setSpatialContext({
        view: step.spatial.view,
        highlights: step.spatial.highlights,
        draw_path: step.spatial.draw_path,
      });
    }
    setFocusedId(step.id);
  }, [setSpatialContext]);

  const handleReset = useCallback(() => {
    setCompleted(new Set());
    const first = steps[0];
    if (first?.spatial) {
      setSpatialContext({
        view: first.spatial.view,
        highlights: first.spatial.highlights,
        draw_path: first.spatial.draw_path,
      });
      setFocusedId(first.id);
    }
  }, [steps, setSpatialContext]);

  if (parseError) {
    return (
      <div className="border border-error/30 rounded-lg px-3 py-2 text-xs text-error font-mono bg-error/5">
        Invalid checklist format — expected a JSON array of steps.
      </div>
    );
  }

  const completedCount = completed.size;
  const total = steps.length;
  const progress = total > 0 ? (completedCount / total) * 100 : 0;
  const allDone = completedCount === total && total > 0;

  return (
    <div className="border border-background-subtle rounded-lg overflow-hidden bg-background shadow-sm w-full">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-background-subtle bg-background-muted">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary text-white flex-shrink-0">
            checklist
          </span>
          <span className="font-heading font-medium text-sm text-foreground truncate">
            {title}
          </span>
        </div>
        <span className="text-[11px] font-mono text-foreground-muted flex-shrink-0 ml-2 tabular-nums">
          {completedCount}/{total}
        </span>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      <div className="h-1 bg-background-subtle">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Steps ───────────────────────────────────────────────────────── */}
      <div className="divide-y divide-background-subtle">
        {steps.map((step, i) => {
          const isDone    = completed.has(step.id);
          const isFocused = focusedId === step.id && !isDone;
          const isNext    = !isDone && steps.find(s => !completed.has(s.id))?.id === step.id;

          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 px-3 py-3 transition-colors cursor-pointer group
                ${isDone
                  ? 'bg-background-muted/40 opacity-60'
                  : isFocused
                    ? 'bg-primary/5 ring-1 ring-inset ring-primary/20'
                    : 'hover:bg-background-muted/30'
                }`}
              onMouseEnter={() => !isDone && handleHover(step)}
            >
              {/* ── Checkbox ──────────────────────────────────────────── */}
              <button
                onClick={() => isDone ? handleUncheck(step) : handleCheck(step)}
                className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center
                  transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                  ${isDone
                    ? 'bg-primary border-primary'
                    : isNext
                      ? 'border-primary animate-pulse'
                      : 'border-background-subtle group-hover:border-primary/50'
                  }`}
                aria-label={isDone ? `Uncheck: ${step.text}` : `Mark done: ${step.text}`}
                aria-checked={isDone}
                role="checkbox"
              >
                {isDone && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"
                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1.5,5 4,7.5 8.5,2" />
                  </svg>
                )}
              </button>

              {/* ── Content ───────────────────────────────────────────── */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`text-[10px] font-mono tabular-nums flex-shrink-0
                    ${isDone ? 'text-foreground-subtle' : 'text-foreground-muted'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`text-sm font-medium leading-snug
                    ${isDone ? 'line-through text-foreground-muted' : 'text-foreground'}`}>
                    {step.text}
                  </span>
                </div>

                {step.detail && !isDone && (
                  <p className="text-xs text-foreground-muted mt-1 ml-6 leading-relaxed">
                    {step.detail}
                  </p>
                )}

                <div className="ml-6">
                  <StepSpatialBadge step={step} />
                </div>
              </div>

              {/* ── "Next" indicator ──────────────────────────────────── */}
              {isNext && !isDone && (
                <div className="flex-shrink-0 mt-1">
                  <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded">
                    Next
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── All done footer ─────────────────────────────────────────────── */}
      {allDone && (
        <div className="px-3 py-3 bg-primary/5 border-t border-primary/20 text-center">
          <p className="text-sm font-medium text-foreground">
            All steps complete — did that resolve the issue?
          </p>
          <button
            onClick={handleReset}
            className="mt-1 text-xs text-foreground-muted hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Reset checklist
          </button>
        </div>
      )}
    </div>
  );
}

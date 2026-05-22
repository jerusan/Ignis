import React, { useMemo } from 'react';
import { useWorkbench } from '../WorkbenchOverlay';
import type { ChecklistStep } from '../../lib/artifacts';

export function ChatStepStepper() {
  const { activeChecklist, spatialContext, sendMessage } = useWorkbench();

  const steps = useMemo<ChecklistStep[]>(() => {
    if (!activeChecklist) return [];
    try {
      const parsed: unknown = JSON.parse(activeChecklist.code);
      return Array.isArray(parsed) ? (parsed as ChecklistStep[]) : [];
    } catch {
      return [];
    }
  }, [activeChecklist]);

  // Infer current step from spatial context highlights overlap
  const currentIdx = useMemo(() => {
    if (!spatialContext || steps.length === 0) return 0;
    const idx = steps.findIndex(s =>
      s.spatial?.highlights.some(h => spatialContext.highlights.includes(h)),
    );
    return idx >= 0 ? idx : 0;
  }, [steps, spatialContext]);

  // spatialContext becomes null after the last step completes — hide rather than
  // snap back to step 1 (which is what happens when currentIdx falls back to 0).
  if (steps.length === 0 || !spatialContext) return null;

  const stepTitle = activeChecklist?.title ?? 'Procedure';

  return (
    <div className="flex-shrink-0 border-b border-background-subtle bg-background px-4 py-2.5">
      {/* Title + count */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground truncate pr-4">
          {stepTitle}
        </span>
        <span className="text-[11px] font-mono text-foreground-muted flex-shrink-0 tabular-nums">
          {currentIdx + 1} / {steps.length}
        </span>
      </div>

      {/* Step dots + connector track */}
      <div className="flex items-center gap-0 overflow-x-auto pb-0.5">
        {steps.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() =>
                  sendMessage(`Jump to step ${i + 1}: ${step.text}`)
                }
                title={step.text}
                className={`flex-shrink-0 rounded-full flex items-center justify-center font-mono font-bold transition-all duration-200 min-w-[28px] min-h-[28px] text-[10px] ${
                  isCurrent
                    ? 'w-7 h-7 bg-primary text-white shadow-sm shadow-primary/40 ring-2 ring-primary/30'
                    : isDone
                      ? 'w-6 h-6 bg-primary/70 text-white'
                      : 'w-6 h-6 bg-background-subtle text-foreground-subtle border border-background-subtle hover:border-primary/40 hover:text-foreground-muted'
                }`}
                aria-label={`Step ${i + 1}: ${step.text}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isDone ? (
                  <svg
                    className="w-2.5 h-2.5"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="1.5,5 4,7.5 8.5,2" />
                  </svg>
                ) : (
                  i + 1
                )}
              </button>

              {/* Connector track */}
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 min-w-[6px] max-w-[24px] transition-colors duration-300 ${
                    i < currentIdx ? 'bg-primary/70' : 'bg-background-subtle'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current step label */}
      {steps[currentIdx] && (
        <p className="text-[11px] text-foreground-muted mt-1.5 truncate">
          {steps[currentIdx].text}
        </p>
      )}
    </div>
  );
}

export default ChatStepStepper;

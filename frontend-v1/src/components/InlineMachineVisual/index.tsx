import React from 'react';
import {
  ZapIcon,
  CheckIcon,
  ChevronRightIcon,
  WrenchIcon,
} from 'lucide-react';
import { SpatialViewport, REGISTRY_BY_VIEW } from '../SpatialViewport';
import type { MachineView } from '../../types/chat';
import type { SpatialContextTag } from '../../lib/artifacts';
import { useWorkbench } from '../WorkbenchOverlay';

const VIEW_FULL_LABELS: Record<MachineView, string> = {
  front: 'Front View',
  interior: 'Interior View',
  back: 'Rear View',
};

// ── Numbered callout badges — positioned absolute on top of SpatialViewport ────
interface CalloutBadgesProps {
  spatialContext: SpatialContextTag;
  size?: number;
}

function CalloutBadges({ spatialContext, size = 20 }: CalloutBadgesProps) {
  const registry = REGISTRY_BY_VIEW[spatialContext.view];
  return (
    <>
      {spatialContext.highlights.map((key, idx) => {
        const pt = registry[key];
        if (!pt) return null;
        return (
          <div
            key={key}
            className="absolute pointer-events-none"
            style={{
              left: `${pt.x / 10}%`,
              top: `${pt.y / 10}%`,
              transform: 'translate(-50%, calc(-100% - 8px))',
              zIndex: 20,
            }}
          >
            <div
              className="rounded-full bg-amber-500 text-zinc-950 font-mono font-bold flex items-center justify-center shadow-lg shadow-black/70 ring-1 ring-amber-400/50"
              style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
            >
              {idx + 1}
            </div>
          </div>
        );
      })}
    </>
  );
}


// ── Inline machine visual ───────────────────────────────────────────────────────

export interface InlineMachineVisualProps {
  spatialContext: SpatialContextTag;
  /** true = full expanded card (current/latest step); false = compact thumbnail */
  isCurrentStep: boolean;
  /** Fires when the user clicks "Done — next step" */
  onNextStep?: () => void;
  /** e.g. "Step 2 of 6" shown in thumbnail and header */
  stepLabel?: string;
}

export function InlineMachineVisual({
  spatialContext,
  isCurrentStep,
  onNextStep,
  stepLabel,
}: InlineMachineVisualProps) {
  const { setSpatialContext, open } = useWorkbench();
  const registry = REGISTRY_BY_VIEW[spatialContext.view];
  const highlightCount = spatialContext.highlights.length;
  const viewLabel = VIEW_FULL_LABELS[spatialContext.view];

  // ── Thumbnail (previous step) ──────────────────────────────────────────────
  if (!isCurrentStep) {
    return (
      <>
        <button
          onClick={() => {
            setSpatialContext(spatialContext);
            open();
          }}
          className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg border border-background-subtle bg-background-muted hover:bg-background-subtle transition-colors group min-h-[44px]"
          aria-label={`Show ${viewLabel} on machine viewer`}
        >
          <ZapIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-medium text-foreground-muted">{viewLabel}</span>
          <span className="text-foreground-subtle text-xs">·</span>
          <span className="text-xs text-foreground-subtle">
            {highlightCount} part{highlightCount !== 1 ? 's' : ''}
          </span>
          {stepLabel && (
            <>
              <span className="text-foreground-subtle text-xs">·</span>
              <span className="text-xs font-mono text-foreground-subtle">{stepLabel}</span>
            </>
          )}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <span className="text-[10px] font-mono text-amber-500/80 opacity-0 group-hover:opacity-100 transition-opacity">
              Show in Viewer
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSpatialContext(spatialContext);
                open();
              }}
              title="Show in Machine Viewer"
              className="p-1 text-foreground-subtle hover:text-amber-500 hover:bg-zinc-800 rounded transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center min-w-[24px] min-h-[24px]"
            >
              <WrenchIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </button>
      </>
    );
  }

  // ── Full expanded card (current step) ──────────────────────────────────────
  return (
    <>
      {/* max-w-xs caps width at 320px — at that size the 1:1 product images
          render at ≤320px tall, fitting within ~55% of a 768px laptop viewport */}
      <div className="rounded-lg overflow-visible border border-zinc-800 bg-zinc-950 animate-fade-in shadow-md w-full max-w-xs">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/80 border-b border-zinc-800 rounded-t-lg">
          <div className="flex items-center gap-2 min-w-0">
            <ZapIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-zinc-200">{viewLabel}</span>
            {highlightCount > 0 && (
              <>
                <span className="text-zinc-700 text-xs">·</span>
                <span className="text-xs text-zinc-400">
                  {highlightCount} part{highlightCount !== 1 ? 's' : ''} highlighted
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => {
                setSpatialContext(spatialContext);
                open();
              }}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1.5 rounded hover:bg-zinc-800 min-h-[36px] justify-center"
              aria-label="Show in Machine Viewer"
            >
              <WrenchIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Show in Viewer</span>
            </button>
          </div>
        </div>

        {/* ── Machine image ─────────────────────────────────────────────── */}
        <div
          onClick={() => {
            setSpatialContext(spatialContext);
            open();
          }}
          className="relative overflow-hidden rounded-b-[0] bg-zinc-950 cursor-pointer group/image"
          title="Click to show on interactive machine viewer"
        >
          <SpatialViewport
            currentView={spatialContext.view}
            registry={registry}
            highlightedComponents={spatialContext.highlights}
            drawPath={spatialContext.draw_path}
            isOverlay
          />
          {/* Numbered badges float above the SpatialViewport SVG layer */}
          <CalloutBadges spatialContext={spatialContext} size={20} />
          {/* Premium hover focus overlay */}
          <div className="absolute inset-0 bg-amber-500/0 group-hover/image:bg-amber-500/[0.03] transition-all duration-200 pointer-events-none flex items-center justify-center">
            <span className="bg-zinc-950/90 text-amber-400 text-[10px] font-mono px-2.5 py-1 rounded-md border border-amber-500/35 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200 shadow-xl shadow-black/40">
              Focus in Machine Viewer
            </span>
          </div>
        </div>

        {/* ── Callout list — compact horizontal pills ───────────────────── */}
        {highlightCount > 0 && (
          <div className="border-t border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {spatialContext.highlights.map((key, idx) => {
                const pt = registry[key];
                if (!pt) return null;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSpatialContext({
                        view: spatialContext.view,
                        highlights: [key],
                        draw_path: false,
                      });
                      open();
                    }}
                    className="flex items-center gap-1.5 hover:bg-zinc-800/80 px-2 py-1 rounded transition-colors group/pill"
                    title={`Focus ${pt.title} on machine viewer`}
                  >
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold text-[9px] flex items-center justify-center border border-amber-500/30 group-hover/pill:bg-amber-500 group-hover/pill:text-zinc-950 transition-colors">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium text-zinc-300 group-hover/pill:text-white transition-colors">{pt.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── "Done / Next step" action ─────────────────────────────────── */}
        {onNextStep && (
          <div className="border-t border-zinc-800 px-3 py-2.5">
            <button
              onClick={onNextStep}
              className="flex items-center gap-2 w-full justify-center min-h-[44px] px-4 rounded-md text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/8 transition-colors border border-amber-500/20 hover:border-amber-500/40"
            >
              <CheckIcon className="w-4 h-4 flex-shrink-0" />
              Done — next step
              <ChevronRightIcon className="w-4 h-4 ml-auto flex-shrink-0" />
            </button>
          </div>
        )}
      </div>

    </>
  );
}

export default InlineMachineVisual;

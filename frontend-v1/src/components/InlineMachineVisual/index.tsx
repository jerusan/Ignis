import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ZapIcon,
  MaximizeIcon,
  XIcon,
  CheckIcon,
  ChevronRightIcon,
  WrenchIcon,
} from 'lucide-react';
import {
  SpatialViewport,
  REGISTRY_BY_VIEW,
  MachineView,
} from '../SpatialViewport';
import type { SpatialContextTag } from '../../lib/artifacts';
import { useWorkbench } from '../WorkbenchOverlay';

const VIEW_LABELS: Record<MachineView, string> = {
  front: 'Front',
  interior: 'Interior',
  back: 'Rear',
};

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

// ── Full-screen modal ───────────────────────────────────────────────────────────

interface MachineFullScreenModalProps {
  spatialContext: SpatialContextTag;
  onClose: () => void;
}

export function MachineFullScreenModal({
  spatialContext,
  onClose,
}: MachineFullScreenModalProps) {
  const [activeView, setActiveView] = useState<MachineView>(spatialContext.view);
  const [scale, setScale] = useState(1);
  const lastDist = useRef(0);

  const registry = REGISTRY_BY_VIEW[activeView];
  const highlights =
    activeView === spatialContext.view ? spatialContext.highlights : [];
  const drawPath =
    spatialContext.draw_path && activeView === spatialContext.view;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    } else if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (lastDist.current > 0) {
        const delta = d / lastDist.current;
        setScale(prev => Math.min(4, Math.max(0.8, prev * delta)));
      }
      lastDist.current = d;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    lastDist.current = 0;
    if (touchStartRef.current && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      
      if (dt < 400 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && scale <= 1.05) {
        const VIEWS: MachineView[] = ['front', 'interior', 'back'];
        const currentIndex = VIEWS.indexOf(activeView);
        if (dx > 0) {
          const nextIndex = (currentIndex + 1) % VIEWS.length;
          setActiveView(VIEWS[nextIndex]);
        } else {
          const prevIndex = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
          setActiveView(VIEWS[prevIndex]);
        }
      }
    }
    touchStartRef.current = null;
  }, [activeView, scale]);

  const handleDoubleTap = useCallback(() => {
    setScale(prev => (prev > 1.1 ? 1 : 2));
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Machine diagram"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg">
          {(Object.keys(VIEW_LABELS) as MachineView[]).map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-w-[60px] min-h-[36px] ${
                activeView === view
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {VIEW_LABELS[view]}
            </button>
          ))}
        </div>

        {scale !== 1 && (
          <button
            onClick={() => setScale(1)}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 transition-colors"
          >
            {Math.round(scale * 100)}% · Reset
          </button>
        )}

        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          aria-label="Close"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* ── Image area ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center px-2"
        style={{ touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
      >
        <div
          className="w-full max-w-md transition-transform duration-100 origin-center"
          style={{ transform: `scale(${scale})` }}
        >
          <div className="relative">
            <SpatialViewport
              currentView={activeView}
              registry={registry}
              highlightedComponents={highlights}
              drawPath={drawPath}
            />
            <CalloutBadges
              spatialContext={{ ...spatialContext, highlights, view: activeView }}
              size={24}
            />
          </div>
        </div>
      </div>

      {/* ── Callout legend ─────────────────────────────────────────────── */}
      {highlights.length > 0 && (
        <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm px-4 py-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {highlights.map((key, idx) => {
              const pt = registry[key];
              if (!pt) return null;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold text-[10px] flex items-center justify-center border border-amber-500/30 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-zinc-200">{pt.title}</span>
                </div>
              );
            })}
          </div>
          {scale === 1 && (
            <p className="text-[10px] text-zinc-600 mt-2">
              Double-tap to zoom · Pinch to zoom in/out
            </p>
          )}
        </div>
      )}
    </div>,
    document.body,
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
  const [showFullScreen, setShowFullScreen] = useState(false);
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
                setShowFullScreen(true);
              }}
              title="Open full screen modal"
              className="p-1 text-foreground-subtle hover:text-foreground hover:bg-zinc-800 rounded transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center min-w-[24px] min-h-[24px]"
            >
              <MaximizeIcon className="w-3.5 h-3.5" />
            </button>
            <WrenchIcon className="w-3.5 h-3.5 text-foreground-subtle group-hover:text-amber-500 transition-colors" />
          </div>
        </button>

        {showFullScreen && (
          <MachineFullScreenModal
            spatialContext={spatialContext}
            onClose={() => setShowFullScreen(false)}
          />
        )}
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
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors px-2 py-1 py-1.5 rounded hover:bg-zinc-800 min-h-[36px] justify-center"
              aria-label="Show in Machine Viewer"
            >
              <WrenchIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Show in Viewer</span>
            </button>
            <button
              onClick={() => setShowFullScreen(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1.5 rounded hover:bg-zinc-800 min-h-[36px] justify-center"
              aria-label="Open full view"
            >
              <MaximizeIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Full view</span>
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

      {showFullScreen && (
        <MachineFullScreenModal
          spatialContext={spatialContext}
          onClose={() => setShowFullScreen(false)}
        />
      )}
    </>
  );
}

export default InlineMachineVisual;

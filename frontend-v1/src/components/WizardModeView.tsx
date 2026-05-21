import { SpatialViewport, REGISTRY_BY_VIEW } from './SpatialViewport';
import type { MachineView } from './SpatialViewport';

// ── Shared step shape used by both checklist and text-based wizard ──────────

export interface WizardStep {
  text: string;
  detail?: string;
  spatial?: {
    view: MachineView;
    highlights: string[];
    draw_path?: boolean;
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  title: string;
  steps: WizardStep[];
  currentStepIdx: number;
  onNext: () => void;
  onExit: () => void;
}

// ── Machine image area ────────────────────────────────────────────────────────

function MachineImage({ currentStep }: { currentStep: WizardStep }) {
  const spatial = currentStep.spatial ?? null;

  if (spatial) {
    const registry = REGISTRY_BY_VIEW[spatial.view];
    return (
      <div className="relative overflow-hidden rounded-2xl mx-auto w-full"
           style={{ backgroundColor: '#0f1114', border: '1px solid #2a2f3b', maxWidth: '480px' }}>
        <SpatialViewport
          currentView={spatial.view}
          registry={registry}
          highlightedComponents={spatial.highlights}
          drawPath={spatial.draw_path}
          isOverlay
        />
      </div>
    );
  }

  // Fallback — plain product image
  return (
    <div
      className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
      style={{
        backgroundColor: '#1a1d24',
        border: '1px solid #2a2f3b',
        aspectRatio: '4 / 3',
      }}
    >
      <img
        src="/product-front.png"
        alt="Vulcan OmniPro 220"
        className="w-full h-full object-contain p-6"
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WizardModeView({
  title,
  steps,
  currentStepIdx,
  onNext,
  onExit,
}: Props) {
  const total = steps.length;
  const step = steps[currentStepIdx];
  const isLast = currentStepIdx === total - 1;

  return (
    <div
      className="flex flex-col h-full animate-fade-in"
      style={{ backgroundColor: '#0f1114' }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 animate-slide-down"
        style={{ backgroundColor: '#1a1d24', borderBottom: '1px solid #2a2f3b' }}
      >
        <div className="min-w-0">
          <p
            className="text-[10px] font-mono font-bold uppercase tracking-widest mb-0.5"
            style={{ color: '#ff6b00' }}
          >
            Guided Procedure
          </p>
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: '#e6e9ef' }}
          >
            {title}
          </h2>
        </div>
        <button
          onClick={onExit}
          className="ml-3 flex-shrink-0 text-xs px-3 py-1.5 rounded-lg
                     transition-colors hover:opacity-80"
          style={{
            backgroundColor: '#21252e',
            color: '#a3a9b8',
            border: '1px solid #2a2f3b',
          }}
        >
          Exit
        </button>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid #2a2f3b' }}
      >
        <div className="flex items-center gap-1 flex-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all duration-500"
              style={{
                backgroundColor:
                  i < currentStepIdx
                    ? 'rgba(255,107,0,0.45)'
                    : i === currentStepIdx
                    ? '#ff6b00'
                    : '#2a2f3b',
              }}
            />
          ))}
        </div>
        <span
          className="flex-shrink-0 text-xs font-mono tabular-nums"
          style={{ color: '#a3a9b8' }}
        >
          {currentStepIdx + 1}&thinsp;/&thinsp;{total}
        </span>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">

        {/* Machine image */}
        <MachineImage
          currentStep={step}
          key={currentStepIdx}
        />

        {/* Step card */}
        <div
          className="rounded-2xl px-5 py-4 animate-slide-up"
          key={`step-${currentStepIdx}`}
          style={{ backgroundColor: '#1a1d24', border: '1px solid #2a2f3b' }}
        >
          <div className="flex items-start gap-3">
            <span
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center
                         justify-center text-xs font-bold text-white"
              style={{ backgroundColor: '#ff6b00' }}
            >
              {currentStepIdx + 1}
            </span>
            <div className="min-w-0">
              <h3
                className="font-semibold text-base leading-snug mb-1"
                style={{ color: '#e6e9ef' }}
              >
                {step.text}
              </h3>
              {step.detail && (
                <p className="text-sm leading-relaxed" style={{ color: '#a3a9b8' }}>
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Up-next preview */}
        {currentStepIdx + 1 < total && (
          <div className="space-y-2">
            <p
              className="text-[10px] uppercase tracking-widest font-mono"
              style={{ color: '#6b7585' }}
            >
              Up next
            </p>
            {steps.slice(currentStepIdx + 1, currentStepIdx + 3).map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  backgroundColor: '#1a1d24',
                  border: '1px solid #2a2f3b',
                  opacity: 0.5,
                }}
              >
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center
                             justify-center text-[10px] font-bold"
                  style={{ backgroundColor: '#21252e', color: '#a3a9b8' }}
                >
                  {currentStepIdx + 2 + i}
                </span>
                <span
                  className="text-sm truncate"
                  style={{ color: '#a3a9b8' }}
                >
                  {s.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CTA button ────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 py-4"
        style={{ borderTop: '1px solid #2a2f3b', backgroundColor: '#1a1d24' }}
      >
        <button
          onClick={onNext}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white
                     flex items-center justify-center gap-2
                     transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          style={{
            backgroundColor: '#ff6b00',
            boxShadow: '0 4px 20px rgba(255, 107, 0, 0.35)',
          }}
        >
          {isLast ? (
            <>
              <CheckIcon />
              Setup Complete
            </>
          ) : (
            <>
              Done — Next Step
              <ArrowRightIcon />
            </>
          )}
        </button>
        {!isLast && (
          <p className="text-center text-xs mt-2" style={{ color: '#6b7585' }}>
            Step {currentStepIdx + 1} of {total}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
         className="w-5 h-5">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
         className="w-5 h-5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Text-step parser (exported for use in IgnisApp) ───────────────────────────

export interface ParsedWizardProcedure {
  title: string;
  steps: WizardStep[];
}

export function parseTextWizardSteps(text: string): ParsedWizardProcedure | null {
  // Extract heading as title
  const headingMatch = text.match(/^#{1,3}\s+(.+)/m);

  // Match numbered list lines: "1. **Bold title** — detail" or "1. Plain text"
  const rawSteps = [...text.matchAll(/(?:^|\n)\s*(\d+)\.\s+(.+)/g)];
  if (rawSteps.length < 3) return null;

  const steps: WizardStep[] = rawSteps.map((m) => {
    const raw = m[2].trim();
    // "**Bold title** — detail text"
    const boldMatch = raw.match(/^\*\*([^*]+)\*\*(?:\s*[—–-]\s*(.+))?$/);
    if (boldMatch) {
      return { text: boldMatch[1].trim(), detail: boldMatch[2]?.trim() };
    }
    // "Title — detail text"
    const dashMatch = raw.match(/^([^—–]+?)\s*[—–]\s*(.+)$/);
    if (dashMatch) {
      return { text: dashMatch[1].trim(), detail: dashMatch[2].trim() };
    }
    return { text: raw };
  });

  // Derive a procedure title
  let title = headingMatch?.[1]?.trim() ?? 'Setup Procedure';
  const PROCEDURE_KEYWORDS = [
    'Wire Feed Setup', 'Flux-Cored', 'MIG Setup', 'Polarity Setup',
    'Stick Setup', 'TIG Setup', 'Drive Roll', 'Shielding Gas', 'Welding Setup',
  ];
  for (const kw of PROCEDURE_KEYWORDS) {
    if (text.toLowerCase().includes(kw.toLowerCase())) {
      title = kw;
      break;
    }
  }

  return { title, steps };
}

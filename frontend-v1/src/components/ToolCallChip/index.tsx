import { useState, type ComponentType } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
  GaugeIcon,
  ImageIcon,
  StethoscopeIcon,
  WrenchIcon,
  CheckIcon,
  LoaderIcon,
  XIcon } from
'lucide-react';
export type ToolName =
'get_machine_spec' |
'diagnose_defect' |
'get_visual' |
'search_manual' |
string;
export type ToolStatus = 'running' | 'done' | 'error';
export interface ToolCallChipProps {
  tool: ToolName;
  status?: ToolStatus;
  input?: Record<string, unknown>;
  result?: string;
  defaultOpen?: boolean;
}
const TOOL_META: Record<
  string,
  {
    label: string;
    icon: ComponentType<{
      className?: string;
    }>;
  }> =
{
  get_machine_spec: {
    label: 'Checking specs',
    icon: GaugeIcon
  },
  diagnose_defect: {
    label: 'Diagnosing',
    icon: StethoscopeIcon
  },
  get_visual: {
    label: 'Looking up diagram',
    icon: ImageIcon
  },
  search_manual: {
    label: 'Searching manual',
    icon: SearchIcon
  }
};
function ToolCallChip({
  tool,
  status = 'done',
  input,
  result,
  defaultOpen = false
}: ToolCallChipProps) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = TOOL_META[tool] ?? {
    label: tool,
    icon: WrenchIcon
  };
  const Icon = meta.icon;
  const hasDetails = input || result;
  const statusIcon =
  status === 'running' ?
  <LoaderIcon className="w-3 h-3 animate-spin text-info" /> :
  status === 'error' ?
  <XIcon className="w-3 h-3 text-error" /> :

  <CheckIcon className="w-3 h-3 text-success" />;

  return (
    <div className="inline-flex flex-col max-w-full border border-background-subtle rounded-md bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        disabled={!hasDetails}
        aria-expanded={open}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground-muted ${hasDetails ? 'hover:bg-background-muted cursor-pointer' : 'cursor-default'}`}>
        
        {hasDetails && (
        open ?
        <ChevronDownIcon className="w-3 h-3" /> :

        <ChevronRightIcon className="w-3 h-3" />)
        }
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span>{meta.label}</span>
        <span className="font-mono text-foreground-subtle">·</span>
        <code className="font-mono text-[11px] text-foreground-subtle">
          {tool}
        </code>
        <span className="ml-1">{statusIcon}</span>
      </button>
      {open && hasDetails &&
      <div className="border-t border-background-subtle bg-background-muted px-3 py-2 text-xs space-y-2">
          {input &&
        <div>
              <div className="text-foreground-subtle uppercase tracking-wide text-[10px] mb-1">
                Input
              </div>
              <pre className="font-mono text-foreground whitespace-pre-wrap break-words">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
        }
          {result &&
        <div>
              <div className="text-foreground-subtle uppercase tracking-wide text-[10px] mb-1">
                Result
              </div>
              <pre className="font-mono text-foreground whitespace-pre-wrap break-words">
                {result}
              </pre>
            </div>
        }
        </div>
      }
    </div>);

}
export default ToolCallChip;

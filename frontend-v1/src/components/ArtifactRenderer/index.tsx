import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CodeIcon,
  EyeIcon,
  AlertTriangleIcon,
  RefreshCwIcon } from
'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkbench } from '../WorkbenchOverlay';
import { WIDGET_REGISTRY } from '../widgets';
import type { ArtifactType } from '../../types/chat';

export type { ArtifactType };

export interface ArtifactRendererProps {
  id?: string;
  type: ArtifactType;
  title: string;
  code: string;
  source_pages?: string;
  height?: number | string;
  defaultView?: 'preview' | 'code';
  /** Render as a compact workbench-redirect chip instead of the full artifact. */
  compact?: boolean;
  /** Fill the parent container vertically rather than using a fixed pixel height. */
  fillHeight?: boolean;
  /** For type="widget": which pre-built component to render. */
  widgetName?: string;
}
const SCRIPT_OPEN = '<' + 'script';
const SCRIPT_CLOSE = '<' + '/script>';
const SANDBOX_STYLE =
'body { margin: 0; font-family: system-ui, sans-serif; padding: 16px; } ' +
'#error { color: #b91c1c; background: #fef2f2; padding: 12px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; }';
const SANDBOX_HTML =
'<!doctype html><html><head><meta charset="utf-8" />' +
 '<style>' +
SANDBOX_STYLE +
'</style>' +
SCRIPT_OPEN +
' src="/sandbox/react.production.min.js">' +
SCRIPT_CLOSE +
SCRIPT_OPEN +
' src="/sandbox/react-dom.production.min.js">' +
SCRIPT_CLOSE +
SCRIPT_OPEN +
' src="/sandbox/babel.min.js">' +
SCRIPT_CLOSE +
'</head><body><div id="root"></div>' +
SCRIPT_OPEN +
'>' +
"window.addEventListener('message', function(e) {" +
"  if (e.data && e.data.type === 'render') {" +
'    try {' +
// Pre-process: strip import statements and export keywords that break new Function()
"      var raw = e.data.code;" +
"      var cleaned = raw" +
"        .replace(/^import\\s[\\s\\S]*?(?:from\\s+['\"][^'\"]*['\"]\\s*)?;?\\s*$/gm, '')" +
"        .replace(/^export\\s+default\\s+/gm, '')" +
"        .replace(/^export\\s+(function|class|const|let|var)/gm, '$1');" +
// Try TypeScript+React presets (babel standalone includes both); fall back to React-only
"      var transformed;" +
"      try {" +
"        transformed = Babel.transform(cleaned, { presets: ['react', 'typescript'], filename: 'app.tsx' }).code;" +
"      } catch (_) {" +
"        transformed = Babel.transform(cleaned, { presets: ['react'] }).code;" +
"      }" +
"      var updateWorkbench = function(payload) { window.parent.postMessage({ type: 'ignis:updateWorkbench', payload: payload }, '*'); };" +
"      var fn = new Function('React','ReactDOM','useState','useEffect','useRef','useMemo','useCallback','useReducer','createElement','updateWorkbench', transformed + '; if (typeof App !== \"undefined\") ReactDOM.createRoot(document.getElementById(\"root\")).render(React.createElement(App));');" +
'      fn(React,ReactDOM,React.useState,React.useEffect,React.useRef,React.useMemo,React.useCallback,React.useReducer,React.createElement,updateWorkbench);' +
'    } catch (err) {' +
"      document.getElementById('root').innerHTML = '<pre id=\"error\">' + (err.message || String(err)) + '</pre>';" +
'    }' +
'  }' +
'});' +
SCRIPT_CLOSE +
'</body></html>';

const MERMAID_STYLE =
'body { margin: 0; padding: 16px; background: #fff; display: flex; align-items: flex-start; justify-content: center; overflow: auto; }' +
'#error { color: #b91c1c; background: #fef2f2; padding: 12px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; width: 100%; }' +
'svg { max-width: 100%; height: auto; }';

const MERMAID_HTML =
'<!doctype html><html><head><meta charset="utf-8" />' +
'<style>' + MERMAID_STYLE + '</style>' +
SCRIPT_OPEN + ' src="/sandbox/mermaid.min.js">' + SCRIPT_CLOSE +
'</head><body><div id="diagram"></div>' +
SCRIPT_OPEN + '>' +
'mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });' +
"window.addEventListener('message', function(e) {" +
"  if (!e.data || e.data.type !== 'render') return;" +
"  mermaid.render('ignis-diagram', e.data.code).then(function(r) {" +
"    document.getElementById('diagram').innerHTML = r.svg;" +
"  }).catch(function(err) {" +
"    document.getElementById('diagram').innerHTML = '<pre id=\"error\">' + (err.message || String(err)) + '</pre>';" +
'  });' +
'});' +
SCRIPT_CLOSE +
'</body></html>';
function ArtifactRenderer({
  id,
  type,
  title,
  code,
  source_pages,
  height = 360,
  defaultView = 'preview',
  compact = false,
  fillHeight = false,
  widgetName,
}: ArtifactRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<'preview' | 'code'>(defaultView);
  const [error, setError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const { addPinnedArtifact, removePinnedArtifact, pinnedArtifacts, open, setActiveChecklist } = useWorkbench(
    useShallow((s) => ({
      addPinnedArtifact: s.addPinnedArtifact,
      removePinnedArtifact: s.removePinnedArtifact,
      pinnedArtifacts: s.pinnedArtifacts,
      open: s.open,
      setActiveChecklist: s.setActiveChecklist,
    }))
  );
  const isPinned = !!id && pinnedArtifacts.some(p => p.id === id);

  // Compact chip — renders when the full artifact lives in the workbench panel.
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => open()}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border w-full text-left cursor-pointer transition-colors hover:brightness-110"
        style={{
          borderColor: 'rgba(255,107,0,0.2)',
          backgroundColor: 'rgba(255,107,0,0.04)',
        }}
      >
        <span
          className="font-mono text-[9px] uppercase tracking-widest flex-shrink-0 px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(255,107,0,0.12)', color: 'rgba(255,107,0,0.85)' }}
        >
          {type}
        </span>
        <span className="text-sm truncate flex-1" style={{ color: '#d4d8e4' }}>{title}</span>
        {source_pages && (
          <span className="font-mono text-[9px] flex-shrink-0" style={{ color: '#3d4760' }}>
            pp.{source_pages}
          </span>
        )}
        <span className="text-[9px] font-mono flex-shrink-0 flex items-center gap-1 hover:text-amber-500/80 transition-colors" style={{ color: '#3d4760' }}>
          <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1.5" y="1.5" width="11" height="11" rx="1.5"/>
            <line x1="5.5" y1="1.5" x2="5.5" y2="12.5"/>
          </svg>
          Open in Workbench
        </span>
      </button>
    );
  }

  if (type === 'checklist') {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-background-subtle bg-background-muted/30 w-full">
        <span className="text-[9px] font-mono uppercase tracking-widest text-primary/70 flex-shrink-0">checklist</span>
        <span className="text-sm text-foreground truncate flex-1">{title}</span>
        <button
          type="button"
          onClick={() => {
            setActiveChecklist({ id: id || `checklist-${Date.now()}`, type, title, code, source_pages });
            open();
          }}
          className="text-[10px] text-primary hover:text-primary-hover font-mono flex-shrink-0 transition-colors cursor-pointer"
        >
          → Open Machine Viewer
        </button>
      </div>
    );
  }

  // Pre-built widget — rendered natively (no iframe, full React context access).
  if (type === 'widget') {
    const Widget = widgetName ? WIDGET_REGISTRY[widgetName] : null;
    let params: Record<string, unknown> = {};
    try { params = JSON.parse(code); } catch { /* use empty params */ }

    return (
      <div className={`border border-background-subtle rounded-lg overflow-hidden bg-background shadow-sm w-full ${fillHeight ? 'flex flex-col h-full' : ''}`}>
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-background-subtle bg-background-muted">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary text-white flex-shrink-0">
              widget
            </span>
            <span className="font-heading font-medium text-sm text-foreground truncate">{title}</span>
            {source_pages && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-background-subtle text-foreground-muted flex-shrink-0 whitespace-nowrap">
                pp. {source_pages}
              </span>
            )}
          </div>
          {id && (
            <button
              type="button"
              onClick={() => {
                if (isPinned) {
                  removePinnedArtifact(id);
                } else {
                  addPinnedArtifact({ id, type, title, code, source_pages, widgetName });
                }
              }}
              className={`p-1 rounded hover:bg-white/5 transition-all ${
                isPinned ? 'text-orange-500 hover:text-orange-400' : 'text-zinc-550 hover:text-zinc-300'
              }`}
              aria-label={isPinned ? 'Unpin from workbench' : 'Pin to workbench'}
              title={isPinned ? 'Unpin from workbench' : 'Pin to workbench'}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill={isPinned ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 1h5v4.5l2 2.5H2.5l2-2.5V1zM7 8v5" />
              </svg>
            </button>
          )}
        </div>
        <div className={fillHeight ? 'flex-1 min-h-0 overflow-hidden' : ''} style={fillHeight ? undefined : { height }}>
          {Widget
            ? <Widget params={params} />
            : (
              <div className="flex items-center justify-center h-full p-6 text-center">
                <p className="text-xs font-mono text-foreground-muted">Unknown widget: {widgetName ?? '(none)'}</p>
              </div>
            )
          }
        </div>
      </div>
    );
  }

  // svg/html embed code directly; react/mermaid use postMessage after load.
  const isHtmlLike = type === 'svg' || type === 'html';
  const usesPostMessage = type === 'react' || type === 'mermaid';

  useEffect(() => {
    if (!usesPostMessage) {
      setIsIframeLoaded(true);
      return;
    }
    setIsIframeLoaded(false);
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      setIsIframeLoaded(true);
      try {
        iframe.contentWindow?.postMessage({ type: 'render', code }, '*');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [code, usesPostMessage, renderKey]);

  const srcDoc = isHtmlLike
    ? type === 'svg'
      ? '<!doctype html><html><body style="margin:0;padding:16px;display:flex;align-items:center;justify-content:center;background:#fff;">' + code + '</body></html>'
      : code
    : type === 'mermaid'
      ? MERMAID_HTML
      : SANDBOX_HTML;
  return (
    <div className={`border border-background-subtle rounded-lg overflow-hidden bg-background shadow-sm w-full ${fillHeight ? 'flex flex-col h-full' : ''}`}>
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-background-subtle bg-background-muted">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary text-white flex-shrink-0">
            {type}
          </span>
          <span className="font-heading font-medium text-sm text-foreground truncate">
            {title}
          </span>
          {source_pages && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-background-subtle text-foreground-muted flex-shrink-0 whitespace-nowrap">
              pp. {source_pages}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border border-background-subtle overflow-hidden">
            <button
              type="button"
              onClick={() => setView('preview')}
              aria-pressed={view === 'preview'}
              className={`flex items-center gap-1 px-2 py-1 text-xs ${view === 'preview' ? 'bg-primary text-white' : 'bg-background text-foreground-muted hover:bg-background-muted'}`}>
              
              <EyeIcon className="w-3 h-3" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => setView('code')}
              aria-pressed={view === 'code'}
              className={`flex items-center gap-1 px-2 py-1 text-xs ${view === 'code' ? 'bg-primary text-white' : 'bg-background text-foreground-muted hover:bg-background-muted'}`}>
              
              <CodeIcon className="w-3 h-3" />
              Code
            </button>
          </div>
          {id && (
            <button
              type="button"
              onClick={() => {
                if (isPinned) {
                  removePinnedArtifact(id);
                } else {
                  addPinnedArtifact({ id, type, title, code, source_pages });
                }
              }}
              className={`p-1 rounded hover:bg-white/5 transition-all ${
                isPinned ? 'text-orange-500 hover:text-orange-400' : 'text-zinc-550 hover:text-zinc-300'
              }`}
              aria-label={isPinned ? 'Unpin from workbench' : 'Pin to workbench'}
              title={isPinned ? 'Unpin from workbench' : 'Pin to workbench'}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill={isPinned ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 1h5v4.5l2 2.5H2.5l2-2.5V1zM7 8v5" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsIframeLoaded(false);
              setRenderKey((k) => k + 1);
            }}
            className="p-1 rounded hover:bg-background-subtle text-foreground-muted"
            aria-label="Re-render"
            title="Re-render">

            <RefreshCwIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {view === 'preview' ? (
        type === 'markdown' ? (
          <div
            className={`prose-ignis px-4 py-3 overflow-auto bg-background ${fillHeight ? 'flex-1 min-h-0' : ''}`}
            style={fillHeight ? undefined : { maxHeight: height }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{code}</ReactMarkdown>
          </div>
        ) : (
          <div
            className={`relative bg-background ${fillHeight ? 'flex-1 min-h-0' : ''}`}
            style={fillHeight ? undefined : { height }}
          >
            {error && (
              <div className="absolute inset-0 flex items-start gap-2 p-3 bg-error/10 text-error text-xs font-mono overflow-auto z-10">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <pre className="whitespace-pre-wrap break-words">{error}</pre>
              </div>
            )}
            {!isIframeLoaded && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background-muted/90 backdrop-blur-sm z-10 animate-shimmer">
                <div className="flex flex-col items-center gap-2">
                  <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-[10px] font-mono tracking-widest uppercase text-foreground-muted animate-pulse">
                    Rendering Component
                  </span>
                </div>
              </div>
            )}
            <iframe
              key={renderKey}
              ref={iframeRef}
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              title={title}
              className="w-full h-full border-0"
            />
          </div>
        )
      ) : (
        <pre
          className={`font-mono text-xs leading-relaxed text-foreground bg-background-muted p-3 overflow-auto ${fillHeight ? 'flex-1 min-h-0' : ''}`}
          style={fillHeight ? undefined : { maxHeight: height }}
        >
          <code>{code}</code>
        </pre>
      )}
    </div>);

}
export const MemoizedArtifactRenderer = React.memo(ArtifactRenderer);

export default MemoizedArtifactRenderer;

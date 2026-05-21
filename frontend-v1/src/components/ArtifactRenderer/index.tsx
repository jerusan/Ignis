import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CodeIcon,
  EyeIcon,
  AlertTriangleIcon,
  RefreshCwIcon } from
'lucide-react';
import { useWorkbench } from '../WorkbenchOverlay';
export type ArtifactType = 'react' | 'svg' | 'html' | 'checklist' | 'mermaid' | 'markdown';
export interface ArtifactRendererProps {
  id?: string;
  type: ArtifactType;
  title: string;
  code: string;
  source_pages?: string;
  height?: number | string;
  defaultView?: 'preview' | 'code';
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
"      var transformed = Babel.transform(e.data.code, { presets: ['react'] }).code;" +
"      var fn = new Function('React', 'ReactDOM', 'useState', 'useEffect', 'useRef', 'createElement', 'updateWorkbench', transformed + '; if (typeof App !== \"undefined\") ReactDOM.createRoot(document.getElementById(\"root\")).render(React.createElement(App));');" +
"      var updateWorkbench = function(payload) { window.parent.postMessage({ type: 'ignis:updateWorkbench', payload: payload }, '*'); };" +
'      fn(React, ReactDOM, React.useState, React.useEffect, React.useRef, React.createElement, updateWorkbench);' +
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
  defaultView = 'preview'
}: ArtifactRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<'preview' | 'code'>(defaultView);
  const [error, setError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const { addPinnedArtifact, pinnedArtifacts } = useWorkbench();
  const isPinned = !!id && pinnedArtifacts.some(p => p.id === id);

  // Checklist artifacts render in the Workbench panel (LeftZone).
  if (type === 'checklist') {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 w-full">
        <span className="text-[9px] font-mono uppercase tracking-widest text-amber-500 flex-shrink-0">checklist</span>
        <span className="text-sm text-foreground truncate flex-1">{title}</span>
        <span className="text-[10px] text-foreground-muted font-mono flex-shrink-0">→ Workbench</span>
      </div>
    );
  }

  // svg/html embed code directly; react/mermaid use postMessage after load.
  const isHtmlLike = type === 'svg' || type === 'html';
  const usesPostMessage = type === 'react' || type === 'mermaid';

  useEffect(() => {
    if (!usesPostMessage) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
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
    <div className="border border-background-subtle rounded-lg overflow-hidden bg-background shadow-sm w-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-background-subtle bg-background-muted">
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
              onClick={() => addPinnedArtifact({ id, type, title, code, source_pages })}
              disabled={isPinned}
              className={`p-1 rounded hover:bg-background-subtle text-foreground-muted ${isPinned ? 'opacity-40 cursor-not-allowed' : ''}`}
              aria-label={isPinned ? 'Already pinned' : 'Pin to workbench'}
              title={isPinned ? 'Already pinned' : 'Pin to workbench'}>
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
            className="prose-ignis px-4 py-3 overflow-auto bg-background"
            style={{ maxHeight: height }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{code}</ReactMarkdown>
          </div>
        ) : (
          <div className="relative bg-background" style={{ height }}>
            {error && (
              <div className="absolute inset-0 flex items-start gap-2 p-3 bg-error/10 text-error text-xs font-mono overflow-auto z-10">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <pre className="whitespace-pre-wrap break-words">{error}</pre>
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
          className="font-mono text-xs leading-relaxed text-foreground bg-background-muted p-3 overflow-auto"
          style={{ maxHeight: height }}
        >
          <code>{code}</code>
        </pre>
      )}
    </div>);

}
export default ArtifactRenderer;

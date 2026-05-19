import { useMemo } from "react";
import type { Artifact } from "../lib/artifact-schema";

interface Props {
  artifact: Artifact;
}

function buildSandboxHtml(artifact: Artifact): string {
  if (artifact.type === "svg") {
    return `<!DOCTYPE html><html><body style="margin:0;background:#1c1c1e">${artifact.code}</body></html>`;
  }

  // React or HTML: run through Babel in the sandbox
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" crossorigin><\/script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossorigin><\/script>
<script src="https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"><\/script>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 12px; font-family: system-ui, sans-serif;
         background: #1c1c1e; color: #e8e8ea; font-size: 14px; }
  input, select, button { font-family: inherit; }
</style>
</head>
<body>
<div id="root"></div>
<script>
window.onerror = function(msg, _src, _line, _col, err) {
  document.getElementById('root').innerHTML =
    '<pre style="color:#f87171;white-space:pre-wrap;font-size:12px">' +
    (err ? err.stack : msg) + '<\/pre>';
  return true;
};
<\/script>
<script type="text/babel" data-presets="react">
${artifact.code}
try {
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
} catch(e) {
  document.getElementById('root').innerHTML =
    '<pre style="color:#f87171;white-space:pre-wrap;font-size:12px">' + e.stack + '<\/pre>';
}
<\/script>
</body>
</html>`;
}

export default function ArtifactRenderer({ artifact }: Props) {
  const srcdoc = useMemo(() => buildSandboxHtml(artifact), [artifact]);

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <span className="text-xs text-orange-400 font-mono uppercase tracking-wide">
          {artifact.type}
        </span>
        <span className="text-xs text-zinc-400 font-medium">{artifact.title}</span>
      </div>
      <iframe
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        title={artifact.title}
        className="w-full min-h-64 border-0 block"
        style={{ height: "320px" }}
      />
    </div>
  );
}

import React from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ComponentSection } from './ComponentSection';
import { componentRegistry } from './registry';

const DS_SHELL_FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

const mdComponents: any = {
  h1: (props: any) => <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginTop: '1.5rem', marginBottom: '0.5rem' }} {...props} />,
  h2: (props: any) => <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginTop: '1.25rem', marginBottom: '0.5rem' }} {...props} />,
  h3: (props: any) => <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', marginTop: '1rem', marginBottom: '0.5rem' }} {...props} />,
  p: (props: any) => <p style={{ marginTop: '0.5rem', marginBottom: '0.5rem', lineHeight: 1.7 }} {...props} />,
  ul: (props: any) => <ul style={{ paddingLeft: '1.5rem', listStyleType: 'disc', marginTop: '0.5rem', marginBottom: '0.5rem' }} {...props} />,
  ol: (props: any) => <ol style={{ paddingLeft: '1.5rem', listStyleType: 'decimal', marginTop: '0.5rem', marginBottom: '0.5rem' }} {...props} />,
  li: (props: any) => <li style={{ marginTop: '0.25rem', marginBottom: '0.25rem', lineHeight: 1.7 }} {...props} />,
  code: ({ node, className, children, ...props }: any) => {
    const isBlock = node?.position?.start?.line !== node?.position?.end?.line || String(children).includes('\n');
    return isBlock ?
    <code style={{ display: 'block', fontFamily: 'monospace', fontSize: '0.85em', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem', overflowX: 'auto', whiteSpace: 'pre', marginTop: '0.5rem', marginBottom: '0.5rem' }} {...props}>{children}</code> :
    <code style={{ fontSize: '0.85em', fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '0.15em 0.4em', borderRadius: '0.25rem' }} {...props}>{children}</code>;
  },
  pre: ({ children }: any) => <>{children}</>,
  a: (props: any) => <a style={{ color: '#3e63dd', textDecoration: 'underline' }} {...props} />,
  table: (props: any) => <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '0.75rem', marginBottom: '0.75rem', fontSize: '0.875rem' }} {...props} />,
  th: (props: any) => <th style={{ textAlign: 'left', fontWeight: 600, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb' }} {...props} />,
  td: (props: any) => <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }} {...props} />,
  hr: (props: any) => <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', marginTop: '1rem', marginBottom: '1rem' }} {...props} />,
  blockquote: (props: any) => <blockquote style={{ borderLeft: '3px solid #e5e7eb', paddingLeft: '1rem', color: '#6b7280', marginTop: '0.5rem', marginBottom: '0.5rem' }} {...props} />
};

export function ComponentPage() {
  const { name } = useParams<{name: string;}>();
  const decoded = decodeURIComponent(name || '');
  const module = componentRegistry.find((m) => m.componentName === decoded);

  if (!module) {
    return (
      <div
        style={{
          padding: '48px 40px',
          marginLeft: 'auto',
          marginRight: 'auto',
          maxWidth: 'var(--canvas-max-width)',
          fontFamily: DS_SHELL_FONT
        }}>
        
        <p style={{ color: '#6b7280', margin: 0, fontFamily: DS_SHELL_FONT }}>
          Component not found.
        </p>
      </div>);

  }

  return (
    <div
      style={{
        padding: '48px 40px',
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: 'var(--canvas-max-width)'
      }}>
      
      <ComponentSection module={module} title="Previews" />
      {module.contextMd &&
      <div
        style={{
          marginTop: 32,
          fontFamily: DS_SHELL_FONT,
          color: '#374151',
          fontSize: '0.875rem'
        }}>
        
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {module.contextMd}
          </ReactMarkdown>
        </div>
      }
    </div>);

}
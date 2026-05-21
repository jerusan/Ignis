import { useState } from 'react';
import type { HighlightBounds } from '../lib/artifacts';

interface Props {
  src: string;
  alt: string;
  bounds?: HighlightBounds;
  className?: string;
}

export function AnnotatedImage({ src, alt, bounds, className = '' }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const imgClass =
    `block max-h-72 w-auto object-contain rounded-md border border-background-subtle bg-background-muted ${className}`;

  // No bounds or image failed — plain img
  if (!bounds || errored) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setErrored(true)}
        className={imgClass}
      />
    );
  }

  return (
    <div className="relative inline-block">
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={imgClass}
      />
      {loaded && (
        <div
          className="absolute border-2 border-amber-500 bg-amber-500/10 animate-pulse rounded-sm pointer-events-none"
          style={{
            left:   `${bounds.x}%`,
            top:    `${bounds.y}%`,
            width:  `${bounds.width}%`,
            height: `${bounds.height}%`,
          }}
        >
          {bounds.label && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-0.5 text-[10px] font-mono text-amber-400 bg-zinc-950/90 px-1.5 py-0.5 rounded whitespace-nowrap">
              {bounds.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

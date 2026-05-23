import React from 'react';
import type { SpatialControlPoint } from '../../types/chat';

// ─── Tooltip positioning ───────────────────────────────────────────────────
export function resolveTooltipStyle(point: SpatialControlPoint): React.CSSProperties {
    const xPct = point.x / 10;
    const yPct = point.y / 10;
    const rPct = point.radius / 10;
    const above = yPct > 45;
    const vertical: React.CSSProperties = above
        ? { bottom: `${100 - (yPct - rPct) + 0.8}%` }
        : { top: `${yPct + rPct + 0.8}%` };
    let horizontal: React.CSSProperties;
    if (xPct < 28) horizontal = { left: '2%' };
    else if (xPct > 72) horizontal = { right: '2%' };
    else horizontal = { left: `${xPct}%`, transform: 'translateX(-50%)' };
    return { position: 'absolute', zIndex: 20, pointerEvents: 'none', ...vertical, ...horizontal };
}

// ─── Circuit path helpers ──────────────────────────────────────────────────
export function buildOrthogonalPath(x1: number, y1: number, x2: number, y2: number): string {
    const dx = x2 - x1, dy = y2 - y1;
    if (Math.abs(dx) < 3) return `M ${x1} ${y1} L ${x2} ${y2}`;
    if (Math.abs(dy) < 3) return `M ${x1} ${y1} L ${x2} ${y2}`;
    const r = Math.min(18, Math.abs(dx) * 0.35, Math.abs(dy) * 0.35);
    const sx = Math.sign(dx), sy = Math.sign(dy);
    if (Math.abs(dx) >= Math.abs(dy)) {
        return `M ${x1} ${y1} L ${x2 - r * sx} ${y1} Q ${x2} ${y1} ${x2} ${y1 + r * sy} L ${x2} ${y2}`;
    }
    return `M ${x1} ${y1} L ${x1} ${y2 - r * sy} Q ${x1} ${y2} ${x1 + r * sx} ${y2} L ${x2} ${y2}`;
}

export function segmentMidpoints(
    x1: number, y1: number, x2: number, y2: number
): Array<{ cx: number; cy: number; angle: number }> {
    if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) {
        return [
            { cx: (x1 + x2) / 2, cy: y1, angle: x2 > x1 ? 0 : 180 },
            { cx: x2, cy: (y1 + y2) / 2, angle: y2 > y1 ? 90 : 270 },
        ];
    }
    return [
        { cx: x1, cy: (y1 + y2) / 2, angle: y2 > y1 ? 90 : 270 },
        { cx: (x1 + x2) / 2, cy: y2, angle: x2 > x1 ? 0 : 180 },
    ];
}

export function arrowPath(cx: number, cy: number, angleDeg: number): string {
    const a = (angleDeg * Math.PI) / 180;
    const tipX = cx + Math.cos(a) * 10, tipY = cy + Math.sin(a) * 10;
    const b1x = cx - Math.cos(a) * 4 + Math.sin(a) * 6;
    const b1y = cy - Math.sin(a) * 4 - Math.cos(a) * 6;
    const b2x = cx - Math.cos(a) * 4 - Math.sin(a) * 6;
    const b2y = cy - Math.sin(a) * 4 + Math.cos(a) * 6;
    return `M ${tipX} ${tipY} L ${b1x} ${b1y} L ${b2x} ${b2y} Z`;
}

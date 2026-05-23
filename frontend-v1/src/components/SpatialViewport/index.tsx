import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
    SpatialControlPoint,
    WelderTelemetry,
    MachineView,
} from '../../types/chat';
import { WELDER_FRONT_REGISTRY } from './registryData';
import {
    resolveTooltipStyle,
    buildOrthogonalPath,
    segmentMidpoints,
    arrowPath,
} from './helpers';
import TelemetryHUD from './TelemetryHUD';
import HoverTooltip from './HoverTooltip';

export {
  WELDER_FRONT_REGISTRY,
  WELDER_INTERIOR_REGISTRY,
  WELDER_REAR_REGISTRY,
  REGISTRY_BY_VIEW,
} from './registryData';

// ─── Drag state ────────────────────────────────────────────────────────────
type DragState =
    | { type: 'move'; key: string; offsetX: number; offsetY: number }
    | { type: 'resize'; key: string; centerX: number; centerY: number };

// ─── Props ─────────────────────────────────────────────────────────────────
export interface SpatialViewportProps {
    /** Registry keys to highlight. Spotlights those components and darkens the rest. */
    highlightedComponents?: string[];
    /**
     * When true, draws an animated circuit path between highlighted components.
     * Defaults to false — must be explicitly set for connection/wiring explanations.
     */
    drawPath?: boolean;
    /** Upgrade draw_path to animated orthogonal routing with arrowheads. */
    drawPathAnimated?: boolean;
    /** Current-flow direction for arrowhead orientation. Default 'forward'. */
    pathDirection?: 'forward' | 'reverse';
    /** Keys matching a search query — rendered with an orange pulse, distinct from agent amber. */
    searchHighlights?: string[];
    registry?: Record<string, SpatialControlPoint>;
    onAnnotationClick?: (point: SpatialControlPoint) => void;
    isModifyMode?: boolean;
    onSave?: (draft: Record<string, SpatialControlPoint>) => void;
    onDiscard?: () => void;
    /** Overlay mode: strips standalone shadow, tightens border, enables dashboard feel */
    isOverlay?: boolean;
    /** Live telemetry — if provided, renders the real-time HUD at the bottom */
    telemetry?: WelderTelemetry;
    /** Which machine surface to display. Defaults to 'front'. */
    currentView?: MachineView;
    /**
     * Transparent mode — removes the dark bg/border so the image renders directly
     * on the parent surface. Use inside the chat pane (light bg).
     */
    transparent?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────
export const SpatialViewport: React.FC<SpatialViewportProps> = ({
    highlightedComponents,
    drawPath = false,
    drawPathAnimated = false,
    pathDirection = 'forward',
    searchHighlights,
    registry: registryProp,
    onAnnotationClick,
    isModifyMode = false,
    onSave,
    onDiscard,
    isOverlay = false,
    telemetry,
    currentView = 'front',
    transparent = false,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    const [draggingKey, setDraggingKey] = useState<string | null>(null);
    const [draggingType, setDraggingType] = useState<'move' | 'resize' | null>(null);

    // Unique SVG filter/mask ID prefix — prevents collisions when multiple viewports
    // are mounted simultaneously (workbench + inline chat).
    const pfx = useRef(`sv-${Math.random().toString(36).slice(2, 7)}`).current;

    const sourceRegistry = registryProp ?? WELDER_FRONT_REGISTRY;

    // ── Draft ──────────────────────────────────────────────────────────────
    const [draft, setDraft] = useState<Record<string, SpatialControlPoint>>(
        () => ({ ...sourceRegistry })
    );
    const wasModifyMode = useRef(false);
    const latestSource = useRef(sourceRegistry);
    latestSource.current = sourceRegistry;

    useEffect(() => {
        if (isModifyMode && !wasModifyMode.current) {
            setDraft({ ...latestSource.current });
        }
        wasModifyMode.current = isModifyMode;
    }, [isModifyMode]);

    // ── Drag refs ──────────────────────────────────────────────────────────
    const dragStateRef = useRef<DragState | null>(null);

    const getSvgPoint = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const r = containerRef.current.getBoundingClientRect();
        return {
            x: Math.round(Math.max(0, Math.min(1000, ((clientX - r.left) / r.width) * 1000))),
            y: Math.round(Math.max(0, Math.min(1000, ((clientY - r.top) / r.height) * 1000))),
        };
    }, []);

    const handlePinPointerDown = useCallback((
        e: React.PointerEvent, key: string, point: SpatialControlPoint
    ) => {
        if (!isModifyMode) return;
        e.preventDefault();
        e.stopPropagation();
        const svgPos = getSvgPoint(e.clientX, e.clientY);
        dragStateRef.current = { type: 'move', key, offsetX: svgPos.x - point.x, offsetY: svgPos.y - point.y };
        setDraggingKey(key);
        setDraggingType('move');
    }, [isModifyMode, getSvgPoint]);

    const handleResizePointerDown = useCallback((
        e: React.PointerEvent, key: string, point: SpatialControlPoint
    ) => {
        if (!isModifyMode) return;
        e.preventDefault();
        e.stopPropagation();
        dragStateRef.current = { type: 'resize', key, centerX: point.x, centerY: point.y };
        setDraggingKey(key);
        setDraggingType('resize');
    }, [isModifyMode]);

    const handleContainerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const ds = dragStateRef.current;
        if (!ds) return;
        const svgPos = getSvgPoint(e.clientX, e.clientY);
        if (ds.type === 'move') {
            const newX = Math.max(10, Math.min(990, svgPos.x - ds.offsetX));
            const newY = Math.max(10, Math.min(990, svgPos.y - ds.offsetY));
            setDraft(prev => ({ ...prev, [ds.key]: { ...prev[ds.key], x: newX, y: newY } }));
        } else {
            const newRadius = Math.max(8, Math.round(
                Math.sqrt(Math.pow(svgPos.x - ds.centerX, 2) + Math.pow(svgPos.y - ds.centerY, 2))
            ));
            setDraft(prev => ({ ...prev, [ds.key]: { ...prev[ds.key], radius: newRadius } }));
        }
    }, [getSvgPoint]);

    const handleContainerPointerUp = useCallback(() => {
        dragStateRef.current = null;
        setDraggingKey(null);
        setDraggingType(null);
    }, []);

    const handleSave = useCallback(() => onSave?.(draft), [draft, onSave]);
    const handleDiscard = useCallback(() => {
        setDraft({ ...latestSource.current });
        dragStateRef.current = null;
        setDraggingKey(null);
        setDraggingType(null);
        onDiscard?.();
    }, [onDiscard]);

    // ── Derived ────────────────────────────────────────────────────────────
    const activeRegistry = isModifyMode ? draft : sourceRegistry;
    const tooltipKey = isModifyMode ? null : hoveredKey;
    const tooltipPoint = tooltipKey ? activeRegistry[tooltipKey] : null;
    const highlights = isModifyMode ? [] : (highlightedComponents ?? []);
    const isLockedTooltip = !!tooltipKey && highlights.includes(tooltipKey);
    const draggedPoint = draggingKey ? draft[draggingKey] : null;

    const circuitPairs: Array<[SpatialControlPoint, SpatialControlPoint]> = [];
    if (drawPath && highlights.length >= 2) {
        for (let i = 0; i < highlights.length - 1; i++) {
            const from = activeRegistry[highlights[i]];
            const to   = activeRegistry[highlights[i + 1]];
            if (from && to) circuitPairs.push([from, to]);
        }
    }

    // ── Image per view ─────────────────────────────────────────────────────
    const VIEW_IMAGE: Record<MachineView, { src: string; alt: string }> = {
        front:    { src: '/product-front.png',  alt: 'Vulcan Front Console' },
        interior: { src: '/product-inside.png', alt: 'Vulcan Internal Cabinet' },
        back:     { src: '/product-back.png',   alt: 'Vulcan Rear Panel' },
    };
    const { src: imgSrc, alt: imgAlt } = VIEW_IMAGE[currentView];

    // ── Accent colours — warning-amber for agent highlights ────────────────
    // These are intentionally amber (not orange) to visually distinguish agent
    // highlights from the orange editor-UI chrome (modify mode, toolbar, etc.)
    const A_RING      = '#f59e0b';                    // amber-500
    const A_RING_FILL = 'rgba(245,158,11,0.18)';
    const A_PING      = 'rgba(251,191,36,0.40)';      // amber-400 translucent
    const A_DOT       = '#fbbf24';                    // amber-400

    // ── Neutral pin colours — adapt to rendering surface ──────────────────
    const N_RING  = transparent ? 'rgba(63,63,70,0.75)'  : 'rgba(212,212,216,0.80)';
    const N_FILL  = transparent ? 'rgba(0,0,0,0.08)'     : 'rgba(0,0,0,0.35)';
    const N_DOT   = transparent ? '#71717a'              : '#d4d8e4';
    const N_BACK  = transparent ? 'rgba(0,0,0,0.12)'     : 'rgba(255,255,255,0.22)';
    const HV_RING = transparent ? 'rgba(0,0,0,0.80)'     : '#ffffff';
    const HV_FILL = transparent ? 'rgba(0,0,0,0.06)'     : 'rgba(255,255,255,0.10)';
    const HV_DOT  = transparent ? '#18181b'              : '#ffffff';

    // ── Container class ────────────────────────────────────────────────────
    const containerCls = transparent
        ? `relative w-full overflow-hidden select-none transition-all duration-200${isModifyMode ? ' ring-2 ring-orange-500/20' : ''}`
        : [
            'relative w-full border rounded-xl overflow-hidden select-none transition-all duration-200',
            isOverlay ? 'bg-zinc-950' : 'bg-zinc-950 shadow-2xl',
            isModifyMode
                ? 'border-orange-500/60 ring-2 ring-orange-500/20'
                : isOverlay ? 'border-zinc-700/50' : 'border-zinc-800',
          ].join(' ');

    return (
        <div
            ref={containerRef}
            className={containerCls}
            style={{ touchAction: isModifyMode ? 'none' : undefined }}
            onPointerMove={isModifyMode ? handleContainerPointerMove : undefined}
            onPointerUp={isModifyMode ? handleContainerPointerUp : undefined}
            onPointerLeave={isModifyMode ? handleContainerPointerUp : undefined}
        >
            {/* ── Product image — transparent PNG over parent surface ─────── */}
            <img
                src={imgSrc}
                alt={imgAlt}
                className="w-full h-auto object-contain block drop-shadow-[0_0_40px_rgba(255,255,255,0.08)]"
                draggable={false}
            />

            {/* ── SVG marker overlay ─────────────────────────────────────────── */}
            <svg viewBox="0 0 1000 1000" className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                    {/* ── Pin shadow filters — unique per instance ─────────────── */}
                    <filter id={`${pfx}-ms`} x="-40%" y="-40%" width="180%" height="180%">
                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(0,0,0,0.7)" floodOpacity="1" />
                    </filter>
                    {/* Agent-highlight glow: warning-amber */}
                    <filter id={`${pfx}-msa`} x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="rgba(245,158,11,0.8)" floodOpacity="1" />
                    </filter>
                    {/* Drag-mode glow: editor orange */}
                    <filter id={`${pfx}-msd`} x="-60%" y="-60%" width="220%" height="220%">
                        <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="rgba(249,115,22,1.0)" floodOpacity="1" />
                    </filter>
                    {/* Circuit path glow */}
                    <filter id={`${pfx}-cg`} x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* ── Spotlight mask (punches holes at highlighted positions) ─ */}
                    {highlights.length > 0 && (
                        <mask id={`${pfx}-sm`}>
                            <rect x="0" y="0" width="1000" height="1000" fill="white" />
                            {highlights.map(key => {
                                const pt = activeRegistry[key];
                                if (!pt) return null;
                                const holeR = Math.max(pt.radius * 3.2, pt.radius + 60);
                                return (
                                    <circle key={key} cx={pt.x} cy={pt.y} r={holeR} fill="black" />
                                );
                            })}
                        </mask>
                    )}
                    {/* ── CSS animations — instance-scoped march animation ─────── */}
                    <style>{`
                        @keyframes ${pfx}-march {
                            from { stroke-dashoffset: 21; }
                            to   { stroke-dashoffset: 0; }
                        }
                        @keyframes ${pfx}-march-rev {
                            from { stroke-dashoffset: 0; }
                            to   { stroke-dashoffset: 21; }
                        }
                        @keyframes spotlight-breathe {
                            0%, 100% { opacity: 0.62; }
                            50%       { opacity: 0.70; }
                        }
                        @keyframes ${pfx}-search-pulse {
                            0%, 100% { opacity: 0.7; r: 0; }
                            50%       { opacity: 0; r: 1; }
                        }
                    `}</style>
                </defs>

                {/* ── Spotlight overlay (focus mode) ─────────────────────────── */}
                {highlights.length > 0 && (
                    <rect
                        x="0" y="0" width="1000" height="1000"
                        fill="rgba(0,0,0,1)"
                        mask={`url(#${pfx}-sm)`}
                        style={{ animation: 'spotlight-breathe 3s ease-in-out infinite' }}
                    />
                )}

                {/* ── Circuit paths between highlighted components ────────────── */}
                {circuitPairs.map(([from, to], i) => {
                    if (drawPathAnimated) {
                        const pathD = buildOrthogonalPath(from.x, from.y, to.x, to.y);
                        const mids = segmentMidpoints(from.x, from.y, to.x, to.y);
                        const arrows = pathDirection === 'reverse'
                            ? mids.map(m => ({ ...m, angle: (m.angle + 180) % 360 }))
                            : mids;
                        const animName = pathDirection === 'reverse' ? `${pfx}-march-rev` : `${pfx}-march`;
                        return (
                            <g key={i} filter={`url(#${pfx}-cg)`}>
                                <path d={pathD} stroke="rgba(245,158,11,0.22)" strokeWidth="12"
                                    fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                <path d={pathD} stroke={A_RING} strokeWidth="3"
                                    fill="none" strokeLinecap="round" strokeLinejoin="round"
                                    strokeDasharray="14 7"
                                    style={{ animation: `${animName} 0.65s linear infinite` }}
                                />
                                {arrows.map((m, j) => (
                                    <path key={j} d={arrowPath(m.cx, m.cy, m.angle)}
                                        fill={A_DOT} opacity={0.85} />
                                ))}
                            </g>
                        );
                    }
                    return (
                        <g key={i} filter={`url(#${pfx}-cg)`}>
                            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                stroke="rgba(245,158,11,0.25)" strokeWidth="14" strokeLinecap="round" />
                            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                stroke={A_RING} strokeWidth="3" strokeLinecap="round"
                                strokeDasharray="12 6"
                                style={{ animation: `${pfx}-march 0.6s linear infinite` }}
                            />
                        </g>
                    );
                })}

                {Object.entries(activeRegistry).map(([key, point]) => {
                    const isSelected = highlights.includes(key);
                    const isHovered = !isModifyMode && hoveredKey === key;
                    const isDragging = isModifyMode && draggingKey === key;
                    const isActive = isSelected || isHovered || isDragging;

                    const shadow = isDragging
                        ? `url(#${pfx}-msd)`
                        : isActive ? `url(#${pfx}-msa)` : `url(#${pfx}-ms)`;

                    // Selected → amber; drag/modify → orange (editor chrome); neutral → surface-aware
                    const ringFill = isSelected     ? A_RING_FILL
                        : isHovered                 ? HV_FILL
                        : isDragging                ? 'rgba(249,115,22,0.22)'
                        : isModifyMode              ? 'rgba(249,115,22,0.06)'
                        : N_FILL;

                    const ringStroke = isSelected   ? A_RING
                        : isDragging                ? '#f97316'
                        : isHovered                 ? HV_RING
                        : isModifyMode              ? 'rgba(249,115,22,0.55)'
                        : N_RING;

                    return (
                        <g key={key} filter={shadow}>
                            {/* ── Main pin group (click/drag to MOVE) ──────── */}
                            <g
                                className="pointer-events-auto"
                                style={{ cursor: isModifyMode ? (isDragging && draggingType === 'move' ? 'grabbing' : 'grab') : 'pointer' }}
                                onClick={() => !isModifyMode && onAnnotationClick?.(point)}
                                onMouseEnter={() => { if (!isModifyMode) setHoveredKey(key); }}
                                onMouseLeave={() => { if (!isModifyMode) setHoveredKey(null); }}
                                onPointerDown={(e) => handlePinPointerDown(e, key, point)}
                            >
                                {/* Generous hit zone — +20px for gloved-hand usability */}
                                <circle cx={point.x} cy={point.y} r={point.radius + 20} fill="transparent" />

                                {/* Search highlight pulse — orange, distinct from amber agent highlights */}
                                {searchHighlights?.includes(key) && !isSelected && (
                                    <circle cx={point.x} cy={point.y} r={point.radius + 16}
                                        fill="none"
                                        stroke="rgba(251,146,60,0.55)"
                                        strokeWidth={2}
                                        className="animate-ping"
                                        style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                                    />
                                )}

                                {/* Ping halo — amber for agent highlights, orange for drag */}
                                {(isSelected || (isDragging && draggingType === 'move')) && (
                                    <circle cx={point.x} cy={point.y} r={point.radius + 12}
                                        fill="none"
                                        stroke={isSelected ? A_PING : 'rgba(251,146,60,0.40)'}
                                        strokeWidth={1.5}
                                        className="animate-ping"
                                        style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                                    />
                                )}

                                {/* Outer dashed orbit (modify mode only) */}
                                {isModifyMode && (
                                    <circle cx={point.x} cy={point.y} r={point.radius + 8}
                                        fill="none"
                                        stroke={isDragging ? 'rgba(249,115,22,0.65)' : 'rgba(249,115,22,0.25)'}
                                        strokeWidth={isDragging ? 1.5 : 1}
                                        strokeDasharray={isDragging ? '5 3' : '3 4'}
                                    />
                                )}

                                {/* Contrast backing ring — surface-aware */}
                                <circle cx={point.x} cy={point.y} r={point.radius + 1}
                                    fill="none"
                                    stroke={N_BACK}
                                    strokeWidth={isActive ? 4 : 2.5}
                                />

                                {/* Main annotation ring */}
                                <circle cx={point.x} cy={point.y} r={point.radius}
                                    fill={ringFill}
                                    stroke={ringStroke}
                                    strokeWidth={isActive ? 2.5 : isModifyMode ? 1.8 : 2}
                                    strokeDasharray={isSelected ? '7 3' : undefined}
                                />

                                {/* Cardinal ticks — amber when agent-highlighted */}
                                {isSelected && (
                                    <>
                                        <line x1={point.x - point.radius - 7} y1={point.y} x2={point.x - point.radius + 5} y2={point.y} stroke={A_RING} strokeWidth={2.5} strokeLinecap="round" />
                                        <line x1={point.x + point.radius - 5} y1={point.y} x2={point.x + point.radius + 7} y2={point.y} stroke={A_RING} strokeWidth={2.5} strokeLinecap="round" />
                                        <line x1={point.x} y1={point.y - point.radius - 7} x2={point.x} y2={point.y - point.radius + 5} stroke={A_RING} strokeWidth={2.5} strokeLinecap="round" />
                                        <line x1={point.x} y1={point.y + point.radius - 5} x2={point.x} y2={point.y + point.radius + 7} stroke={A_RING} strokeWidth={2.5} strokeLinecap="round" />
                                    </>
                                )}

                                {/* Alignment crosshairs (dragging move — editor chrome) */}
                                {isDragging && draggingType === 'move' && (
                                    <>
                                        <line x1={0} y1={point.y} x2={1000} y2={point.y} stroke="rgba(249,115,22,0.22)" strokeWidth={1} strokeDasharray="4 6" />
                                        <line x1={point.x} y1={0} x2={point.x} y2={1000} stroke="rgba(249,115,22,0.22)" strokeWidth={1} strokeDasharray="4 6" />
                                    </>
                                )}

                                {/* Move handle arrows (modify mode — editor chrome) */}
                                {isModifyMode && !isDragging && (
                                    <>
                                        <line x1={point.x - 8} y1={point.y} x2={point.x - 3} y2={point.y} stroke="rgba(249,115,22,0.6)" strokeWidth={1.5} strokeLinecap="round" />
                                        <line x1={point.x + 3} y1={point.y} x2={point.x + 8} y2={point.y} stroke="rgba(249,115,22,0.6)" strokeWidth={1.5} strokeLinecap="round" />
                                        <line x1={point.x} y1={point.y - 8} x2={point.x} y2={point.y - 3} stroke="rgba(249,115,22,0.6)" strokeWidth={1.5} strokeLinecap="round" />
                                        <line x1={point.x} y1={point.y + 3} x2={point.x} y2={point.y + 8} stroke="rgba(249,115,22,0.6)" strokeWidth={1.5} strokeLinecap="round" />
                                    </>
                                )}

                                {/* Centre dot */}
                                <circle cx={point.x} cy={point.y}
                                    r={isActive ? 5 : isModifyMode ? 4.5 : 3.5}
                                    fill={
                                        isSelected                          ? A_DOT
                                        : isDragging && draggingType === 'move' ? '#fb923c'
                                        : isHovered                        ? HV_DOT
                                        : isModifyMode                     ? 'rgba(249,115,22,0.7)'
                                        : N_DOT
                                    }
                                />
                            </g>

                            {/* ── Resize handle (modify mode only) ─────────── */}
                            {isModifyMode && (
                                <g
                                    className="pointer-events-auto"
                                    style={{ cursor: isDragging && draggingType === 'resize' ? 'grabbing' : 'ew-resize' }}
                                    onPointerDown={(e) => handleResizePointerDown(e, key, point)}
                                >
                                    <circle
                                        cx={point.x + point.radius}
                                        cy={point.y}
                                        r={9}
                                        fill="transparent"
                                        stroke={isDragging && draggingType === 'resize' ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.2)'}
                                        strokeWidth={1}
                                    />
                                    <path
                                        d={`M ${point.x + point.radius} ${point.y - 6}
                                            L ${point.x + point.radius + 6} ${point.y}
                                            L ${point.x + point.radius} ${point.y + 6}
                                            L ${point.x + point.radius - 6} ${point.y}
                                            Z`}
                                        fill={isDragging && draggingType === 'resize' ? '#fb923c' : '#f97316'}
                                        stroke="rgba(255,255,255,0.9)"
                                        strokeWidth={1.2}
                                    />
                                    {isDragging && draggingType === 'resize' && (
                                        <circle cx={point.x} cy={point.y} r={point.radius}
                                            fill="none" stroke="rgba(251,146,60,0.30)" strokeWidth={1}
                                            className="animate-ping"
                                            style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                                        />
                                    )}
                                </g>
                            )}
                        </g>
                    );
                })}

                {/* ── Live coordinate / radius badge ─────────────────────── */}
                {draggedPoint && (() => {
                    const isResize = draggingType === 'resize';
                    const badgeText = isResize
                        ? `r: ${draggedPoint.radius}`
                        : `${draggedPoint.x} · ${draggedPoint.y}`;
                    const badgeW = isResize ? 68 : 88;
                    const badgeX = isResize
                        ? draggedPoint.x + draggedPoint.radius + 14
                        : draggedPoint.x - badgeW / 2;
                    const badgeY = isResize
                        ? draggedPoint.y - 13
                        : draggedPoint.y - draggedPoint.radius - 46;
                    const leaderX1 = isResize ? draggedPoint.x + draggedPoint.radius + 10 : draggedPoint.x;
                    const leaderY1 = isResize ? draggedPoint.y : draggedPoint.y - draggedPoint.radius - 20;
                    const leaderX2 = isResize ? draggedPoint.x + draggedPoint.radius + 4 : draggedPoint.x;
                    const leaderY2 = isResize ? draggedPoint.y : draggedPoint.y - draggedPoint.radius - 4;
                    const textX = badgeX + badgeW / 2;
                    const textY = badgeY + 13;
                    return (
                        <g>
                            <rect x={badgeX} y={badgeY} width={badgeW} height={26} rx={5}
                                fill="rgba(9,9,11,0.92)" stroke="rgba(249,115,22,0.7)" strokeWidth={1.5} />
                            <line x1={leaderX1} y1={leaderY1} x2={leaderX2} y2={leaderY2}
                                stroke="rgba(249,115,22,0.5)" strokeWidth={1} strokeDasharray="2 2" />
                            <text x={textX} y={textY} textAnchor="middle" dominantBaseline="middle"
                                fill="#fb923c" fontSize="18" fontFamily="ui-monospace, monospace" fontWeight="bold">
                                {badgeText}
                            </text>
                        </g>
                    );
                })()}
            </svg>

            {/* ── Modify-mode toolbar ────────────────────────────────────────── */}
            {isModifyMode && (
                <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between bg-zinc-950/92 backdrop-blur-sm px-3 py-2 border-b border-orange-500/30">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                        </span>
                        <span className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-[0.18em]">Modify Mode</span>
                        <span className="text-[10px] font-mono text-zinc-500 hidden sm:block">
                            — drag pins · drag ◆ to resize
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={handleDiscard}
                            className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 px-2.5 py-1 rounded transition-colors">
                            Discard
                        </button>
                        <button onClick={handleSave}
                            className="text-[10px] font-mono font-bold bg-orange-500 hover:bg-orange-400 text-zinc-950 px-3 py-1 rounded transition-colors shadow-[0_0_12px_rgba(249,115,22,0.35)]">
                            Save ↵
                        </button>
                    </div>
                </div>
            )}

            {/* ── Real-time Telemetry HUD ────────────────────────────────────── */}
            {telemetry && <TelemetryHUD telemetry={telemetry} />}

            {/* ── Hover tooltip (normal mode only) ───────────────────────────── */}
            {tooltipPoint && (
                <HoverTooltip
                    tooltipPoint={tooltipPoint}
                    isLockedTooltip={isLockedTooltip}
                    style={resolveTooltipStyle(tooltipPoint)}
                />
            )}
        </div>
    );
};

export default SpatialViewport;

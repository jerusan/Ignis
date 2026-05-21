// frontend/src/components/SpatialViewport.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface SpatialControlPoint {
    x: number;      // Normalized 0–1000 coordinate space
    y: number;
    radius: number;
    title: string;
    desc: string;
}

/** Live readings injected by the WorkbenchOverlay (all fields optional). */
export interface WelderTelemetry {
    amperage?: number;   // A
    voltage?:  number;   // V
    wfs?:      number;   // wire feed speed m/min
}

export const WELDER_CONSOLE_REGISTRY: Record<string, SpatialControlPoint> = {
    "home_button": {
        x: 352,
        y: 401,
        radius: 23,
        title: "Home Button",
        desc: "Returns the user interface to the main home screen or default menu."
    },
    "back_button": {
        x: 641,
        y: 399,
        radius: 25,
        title: "Back Button",
        desc: "Navigates back to the previous screen or menu level in the user interface."
    },
    "lcd_display": {
        x: 496,
        y: 380,
        radius: 46,
        title: "LCD Display",
        desc: "Shows the current welding parameters, settings, status messages, and menu options."
    },
    "control_knob": {
        x: 501,
        y: 504,
        radius: 33,
        title: "Control Knob",
        desc: "A central rotary knob used to navigate menus, adjust settings, and make selections."
    },
    "left_knob": {
        x: 387,
        y: 501,
        radius: 26,
        title: "Left Knob",
        desc: "A side-mounted knob, likely used to adjust specific parameters such as voltage or wire feed speed."
    },
    "right_knob": {
        x: 610,
        y: 500,
        radius: 28,
        title: "Right Knob",
        desc: "A side-mounted knob, likely used to adjust complementary parameters or settings."
    },
    "power_switch": {
        x: 469,
        y: 686,
        radius: 25,
        title: "Power Switch",
        desc: "The main toggle switch to turn the welder's power on or off."
    },
    "mig_gun_spool_gun_cable_socket": {
        x: 402,
        y: 806,
        radius: 25,
        title: "MIG Gun / Spool Gun Cable Socket",
        desc: "Connector port for attaching the MIG or Spool Gun cable to the welder."
    },
    "spool_gun_gas_outlet": {
        x: 346,
        y: 702,
        radius: 33,
        title: "Spool Gun Gas Outlet",
        desc: "Port for connecting the gas supply line when using a Spool Gun for MIG welding."
    },
    "positive_socket": {
        x: 645,
        y: 805,
        radius: 30,
        title: "Positive Socket",
        desc: "Terminal for connecting the positive output cable, typically to the workpiece or ground clamp."
    },
    "negative_socket": {
        x: 503,
        y: 808,
        radius: 30,
        title: "Negative Socket",
        desc: "Terminal for connecting the negative output cable, typically to the welding torch or gun."
    },
    "wire_feed_power_cable": {
        x: 570,
        y: 837,
        radius: 21,
        title: "Wire Feed Power Cable",
        desc: "Cable that supplies power to the wire feed mechanism, often connected to the welding gun."
    },
    "storage_compartment": {
        x: 495,
        y: 592,
        radius: 26,
        title: "Storage Compartment",
        desc: "Internal or external compartment for storing accessories, manuals, or small tools."
    }
};

// ─── Tooltip positioning ───────────────────────────────────────────────────
function resolveTooltipStyle(point: SpatialControlPoint): React.CSSProperties {
    const xPct = point.x / 10;
    const yPct = point.y / 10;
    const rPct = point.radius / 10;
    const above = yPct > 45;
    const vertical: React.CSSProperties = above
        ? { bottom: `${100 - (yPct - rPct) + 0.8}%` }
        : { top: `${yPct + rPct + 0.8}%` };
    let horizontal: React.CSSProperties;
    if (xPct < 28)      horizontal = { left: '2%' };
    else if (xPct > 72) horizontal = { right: '2%' };
    else                horizontal = { left: `${xPct}%`, transform: 'translateX(-50%)' };
    return { position: 'absolute', zIndex: 20, pointerEvents: 'none', ...vertical, ...horizontal };
}

// ─── Drag state ────────────────────────────────────────────────────────────
type DragState =
    | { type: 'move';   key: string; offsetX: number; offsetY: number }
    | { type: 'resize'; key: string; centerX: number; centerY: number };

// ─── Props ─────────────────────────────────────────────────────────────────
interface SpatialViewportProps {
    activeComponent?: string;
    registry?: Record<string, SpatialControlPoint>;
    onAnnotationClick?: (point: SpatialControlPoint) => void;
    isModifyMode?: boolean;
    onSave?: (draft: Record<string, SpatialControlPoint>) => void;
    onDiscard?: () => void;
    /** Overlay mode: strips standalone shadow, tightens border, enables dashboard feel */
    isOverlay?: boolean;
    /** Live telemetry — if provided, renders the real-time HUD at the bottom */
    telemetry?: WelderTelemetry;
}

// ─── Component ─────────────────────────────────────────────────────────────
export const SpatialViewport: React.FC<SpatialViewportProps> = ({
    activeComponent,
    registry: registryProp,
    onAnnotationClick,
    isModifyMode = false,
    onSave,
    onDiscard,
    isOverlay  = false,
    telemetry,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredKey,   setHoveredKey]   = useState<string | null>(null);
    const [draggingKey,  setDraggingKey]  = useState<string | null>(null);
    const [draggingType, setDraggingType] = useState<'move' | 'resize' | null>(null);

    const sourceRegistry = registryProp ?? WELDER_CONSOLE_REGISTRY;

    // ── Draft ──────────────────────────────────────────────────────────────
    const [draft, setDraft] = useState<Record<string, SpatialControlPoint>>(
        () => ({ ...sourceRegistry })
    );
    const wasModifyMode  = useRef(false);
    const latestSource   = useRef(sourceRegistry);
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
            x: Math.round(Math.max(0, Math.min(1000, ((clientX - r.left) / r.width)  * 1000))),
            y: Math.round(Math.max(0, Math.min(1000, ((clientY - r.top)  / r.height) * 1000))),
        };
    }, []);

    // Move drag start
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

    // Resize drag start — triggered from the edge handle
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

    // Container-level move handler (catches movement even between pins)
    const handleContainerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const ds = dragStateRef.current;
        if (!ds) return;
        const svgPos = getSvgPoint(e.clientX, e.clientY);

        if (ds.type === 'move') {
            const newX = Math.max(10, Math.min(990, svgPos.x - ds.offsetX));
            const newY = Math.max(10, Math.min(990, svgPos.y - ds.offsetY));
            setDraft(prev => ({ ...prev, [ds.key]: { ...prev[ds.key], x: newX, y: newY } }));
        } else {
            // resize: radius = distance from pin centre to cursor
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

    const handleSave    = useCallback(() => onSave?.(draft), [draft, onSave]);
    const handleDiscard = useCallback(() => {
        setDraft({ ...latestSource.current });
        dragStateRef.current = null;
        setDraggingKey(null);
        setDraggingType(null);
        onDiscard?.();
    }, [onDiscard]);

    // ── Derived ────────────────────────────────────────────────────────────
    const activeRegistry = isModifyMode ? draft : sourceRegistry;
    const tooltipKey     = isModifyMode ? null : hoveredKey;
    const tooltipPoint   = tooltipKey ? activeRegistry[tooltipKey] : null;
    const isLockedTooltip = tooltipKey === activeComponent;
    const draggedPoint   = draggingKey ? draft[draggingKey] : null;

    return (
        <div
            ref={containerRef}
            className={`relative w-full border bg-zinc-950 rounded-xl overflow-hidden select-none transition-all duration-200 ${
                isOverlay ? '' : 'shadow-2xl'
            } ${
                isModifyMode
                    ? 'border-orange-500/60 ring-2 ring-orange-500/20'
                    : isOverlay ? 'border-zinc-700/50' : 'border-zinc-800'
            }`}
            style={{ touchAction: isModifyMode ? 'none' : undefined }}
            onPointerMove={isModifyMode ? handleContainerPointerMove : undefined}
            onPointerUp={isModifyMode ? handleContainerPointerUp : undefined}
            onPointerLeave={isModifyMode ? handleContainerPointerUp : undefined}
        >
            {/* ── Product image ──────────────────────────────────────────────── */}
            <img
                src="/product-front-no-bg.png"
                alt="Vulcan Front Console"
                className="w-full h-auto object-contain block"
                draggable={false}
            />

            {/* ── SVG marker overlay ─────────────────────────────────────────── */}
            <svg viewBox="0 0 1000 1000" className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                    <filter id="ms"  x="-40%" y="-40%" width="180%" height="180%">
                        <feDropShadow dx="0" dy="0" stdDeviation="4"  floodColor="rgba(0,0,0,0.7)"        floodOpacity="1" />
                    </filter>
                    <filter id="msa" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="6"  floodColor="rgba(249,115,22,0.8)"   floodOpacity="1" />
                    </filter>
                    <filter id="msd" x="-60%" y="-60%" width="220%" height="220%">
                        <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="rgba(249,115,22,1.0)"   floodOpacity="1" />
                    </filter>
                </defs>

                {Object.entries(activeRegistry).map(([key, point]) => {
                    const isSelected = !isModifyMode && activeComponent === key;
                    const isHovered  = !isModifyMode && hoveredKey === key;
                    const isDragging =  isModifyMode && draggingKey === key;
                    const isActive   = isSelected || isHovered || isDragging;

                    const shadow = isDragging ? 'url(#msd)' : isActive ? 'url(#msa)' : 'url(#ms)';
                    const ringFill   = isSelected  ? 'rgba(249,115,22,0.18)'
                                     : isHovered   ? 'rgba(255,255,255,0.10)'
                                     : isDragging  ? 'rgba(249,115,22,0.22)'
                                     : isModifyMode ? 'rgba(249,115,22,0.06)'
                                     : 'rgba(0,0,0,0.35)';
                    const ringStroke = (isSelected || isDragging) ? '#f97316'
                                     : isHovered    ? '#ffffff'
                                     : isModifyMode ? 'rgba(249,115,22,0.55)'
                                     : 'rgba(212,212,216,0.80)';

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
                                {/* Expanded hit zone */}
                                <circle cx={point.x} cy={point.y} r={point.radius + 14} fill="transparent" />

                                {/* Ping halo — selected / moving */}
                                {(isSelected || (isDragging && draggingType === 'move')) && (
                                    <circle cx={point.x} cy={point.y} r={point.radius + 12}
                                        fill="none" stroke="rgba(251,146,60,0.40)" strokeWidth={1.5}
                                        className="animate-ping"
                                        style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                                    />
                                )}

                                {/* Outer dashed orbit (modify mode) */}
                                {isModifyMode && (
                                    <circle cx={point.x} cy={point.y} r={point.radius + 8}
                                        fill="none"
                                        stroke={isDragging ? 'rgba(249,115,22,0.65)' : 'rgba(249,115,22,0.25)'}
                                        strokeWidth={isDragging ? 1.5 : 1}
                                        strokeDasharray={isDragging ? '5 3' : '3 4'}
                                    />
                                )}

                                {/* White contrast backing */}
                                <circle cx={point.x} cy={point.y} r={point.radius + 1}
                                    fill="none" stroke="rgba(255,255,255,0.22)"
                                    strokeWidth={isActive ? 4 : 2.5}
                                />

                                {/* Main ring */}
                                <circle cx={point.x} cy={point.y} r={point.radius}
                                    fill={ringFill} stroke={ringStroke}
                                    strokeWidth={isActive ? 2.5 : isModifyMode ? 1.8 : 2}
                                    strokeDasharray={isSelected ? '7 3' : undefined}
                                />

                                {/* Cardinal ticks (selected) */}
                                {isSelected && (
                                    <>
                                        <line x1={point.x - point.radius - 7} y1={point.y} x2={point.x - point.radius + 5} y2={point.y} stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" />
                                        <line x1={point.x + point.radius - 5} y1={point.y} x2={point.x + point.radius + 7} y2={point.y} stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" />
                                        <line x1={point.x} y1={point.y - point.radius - 7} x2={point.x} y2={point.y - point.radius + 5} stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" />
                                        <line x1={point.x} y1={point.y + point.radius - 5} x2={point.x} y2={point.y + point.radius + 7} stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" />
                                    </>
                                )}

                                {/* Alignment crosshairs (dragging move) */}
                                {isDragging && draggingType === 'move' && (
                                    <>
                                        <line x1={0} y1={point.y} x2={1000} y2={point.y} stroke="rgba(249,115,22,0.22)" strokeWidth={1} strokeDasharray="4 6" />
                                        <line x1={point.x} y1={0} x2={point.x} y2={1000} stroke="rgba(249,115,22,0.22)" strokeWidth={1} strokeDasharray="4 6" />
                                    </>
                                )}

                                {/* Move handle arrows */}
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
                                    fill={(isSelected || (isDragging && draggingType === 'move')) ? '#fb923c' : isHovered ? '#ffffff' : isModifyMode ? 'rgba(249,115,22,0.7)' : '#d4d4d8'}
                                />
                            </g>

                            {/* ── Resize handle (modify mode only) ─────────── */}
                            {isModifyMode && (
                                <g
                                    className="pointer-events-auto"
                                    style={{ cursor: isDragging && draggingType === 'resize' ? 'grabbing' : 'ew-resize' }}
                                    onPointerDown={(e) => handleResizePointerDown(e, key, point)}
                                >
                                    {/* Visual ring around the handle */}
                                    <circle
                                        cx={point.x + point.radius}
                                        cy={point.y}
                                        r={9}
                                        fill="transparent"
                                        stroke={isDragging && draggingType === 'resize' ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.2)'}
                                        strokeWidth={1}
                                    />
                                    {/* Handle diamond */}
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
                                    {/* Resize ring pulse (active) */}
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
                    const isResize  = draggingType === 'resize';
                    const badgeText = isResize
                        ? `r: ${draggedPoint.radius}`
                        : `${draggedPoint.x} · ${draggedPoint.y}`;
                    const badgeW    = isResize ? 68 : 88;
                    const badgeX    = isResize
                        ? draggedPoint.x + draggedPoint.radius + 14
                        : draggedPoint.x - badgeW / 2;
                    const badgeY    = isResize
                        ? draggedPoint.y - 13
                        : draggedPoint.y - draggedPoint.radius - 46;
                    const leaderX1  = isResize ? draggedPoint.x + draggedPoint.radius + 10 : draggedPoint.x;
                    const leaderY1  = isResize ? draggedPoint.y : draggedPoint.y - draggedPoint.radius - 20;
                    const leaderX2  = isResize ? draggedPoint.x + draggedPoint.radius + 4  : draggedPoint.x;
                    const leaderY2  = isResize ? draggedPoint.y : draggedPoint.y - draggedPoint.radius - 4;
                    const textX     = badgeX + badgeW / 2;
                    const textY     = badgeY + 13;
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
            {telemetry && (
                <div className="absolute bottom-0 inset-x-0 z-10 px-4 py-3 bg-zinc-950/88 backdrop-blur-lg border-t border-zinc-800/70">
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                        </span>
                        <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                            Real-time Status
                        </span>
                        <span className="ml-auto text-[8px] font-mono text-zinc-700 uppercase tracking-wider">Live</span>
                    </div>
                    <div className="flex items-end gap-6">
                        {telemetry.amperage !== undefined && (
                            <div className="flex items-baseline gap-1">
                                <span className="text-[22px] font-mono font-bold text-orange-400 tabular-nums leading-none">
                                    {telemetry.amperage}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500 pb-px">A</span>
                            </div>
                        )}
                        {telemetry.voltage !== undefined && (
                            <div className="flex items-baseline gap-1">
                                <span className="text-[22px] font-mono font-bold text-sky-400 tabular-nums leading-none">
                                    {telemetry.voltage}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500 pb-px">V</span>
                            </div>
                        )}
                        {telemetry.wfs !== undefined && (
                            <div className="flex items-baseline gap-1">
                                <span className="text-[22px] font-mono font-bold text-emerald-400 tabular-nums leading-none">
                                    {telemetry.wfs}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500 pb-px">m/min</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Hover tooltip (normal mode only) ───────────────────────────── */}
            {tooltipPoint && (
                <div style={resolveTooltipStyle(tooltipPoint)}>
                    <div className="w-[218px] rounded-lg overflow-hidden shadow-[0_0_0_1px_rgba(249,115,22,0.5),0_8px_32px_rgba(0,0,0,0.85)]">
                        <div className="flex items-center justify-between bg-orange-500/10 border-b border-orange-500/30 px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${isLockedTooltip ? 'bg-orange-400 animate-pulse' : 'bg-zinc-500'}`} />
                                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-orange-400">
                                    {isLockedTooltip ? 'Locked' : 'Hover'}
                                </span>
                            </div>
                            <span className="text-[9px] font-mono text-zinc-500 tabular-nums">
                                {tooltipPoint.x} · {tooltipPoint.y}
                            </span>
                        </div>
                        <div className="bg-zinc-950/98 px-3 py-2.5 backdrop-blur-xl">
                            <p className="text-[12.5px] font-semibold text-zinc-50 leading-tight">{tooltipPoint.title}</p>
                            <p className="text-[11px] text-zinc-400 leading-relaxed mt-1.5">{tooltipPoint.desc}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

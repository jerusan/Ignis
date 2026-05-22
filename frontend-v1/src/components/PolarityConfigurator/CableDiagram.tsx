import React, { useEffect, useState } from 'react';

interface Props {
    mode: 'DCEP' | 'DCEN';
    processKey: string;
}

const ORANGE = '#ff6b00';
const BLUE   = '#38bdf8';
const DASHLEN = 450;

// SVG layout constants
// ViewBox: 0 0 360 240
// Machine panel: x=50 y=108 w=260 h=90 → bottom=198
// Sockets: cy=180, r=16 → top=164
// Device boxes: y=18 h=46 → bottom=64; connector dot cy=53 → cable start y=59

const DEVICE_LABELS: Record<string, string> = {
    MIG:        'MIG GUN',
    flux_cored: 'MIG GUN',
    TIG:        'TIG TORCH',
    Stick:      'ELECTRODE',
};

// For each polarity mode, define:
//   leftPath / rightPath  — SVG cubic-bezier cable routes
//   leftSocket / rightSocket — which terminal the device/clamp connects to
//   leftColor / rightColor  — cable colour (orange = electrode side)
const MODE_CONFIG = {
    DCEP: {
        // gun→(+), clamp→(−): no crossing
        leftPath:    'M 105,59 C 105,120 130,120 130,164',
        rightPath:   'M 255,59 C 255,120 230,120 230,164',
        leftSocket:  '+' as const,
        rightSocket: '−' as const,
        leftColor:   ORANGE,  // electrode side = orange
        rightColor:  BLUE,
    },
    DCEN: {
        // torch→(−), clamp→(+): cables cross in the middle
        leftPath:    'M 105,59 C 105,120 230,120 230,164',
        rightPath:   'M 255,59 C 255,120 130,120 130,164',
        leftSocket:  '−' as const,
        rightSocket: '+' as const,
        leftColor:   BLUE,
        rightColor:  ORANGE,  // electrode side = orange
    },
} as const;

export default function CableDiagram({ mode, processKey }: Props) {
    const [drawn, setDrawn] = useState(false);

    // Reset to invisible, then animate in on next double-frame so the
    // transition fires against the new path geometry.
    useEffect(() => {
        setDrawn(false);
        const outer = requestAnimationFrame(() => {
            const inner = requestAnimationFrame(() => setDrawn(true));
            return () => cancelAnimationFrame(inner);
        });
        return () => cancelAnimationFrame(outer);
    }, [mode, processKey]);

    const cfg         = MODE_CONFIG[mode];
    const deviceLabel = DEVICE_LABELS[processKey] ?? 'GUN';

    const plusColor  = cfg.leftSocket === '+' ? cfg.leftColor : cfg.rightColor;
    const minusColor = cfg.leftSocket === '−' ? cfg.leftColor : cfg.rightColor;

    const cableStyle = (color: string, delay = 0): React.CSSProperties => ({
        fill:            'none',
        stroke:          color,
        strokeWidth:     3,
        strokeLinecap:   'round',
        strokeDasharray: DASHLEN,
        strokeDashoffset: drawn ? 0 : DASHLEN,
        opacity:         drawn ? 1 : 0,
        transition: drawn
            ? `stroke-dashoffset 0.4s ${delay}s ease-in-out, opacity 0.15s ${delay}s ease-in`
            : 'none',
    });

    return (
        <svg
            viewBox="0 0 360 240"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
            aria-label={`${mode} polarity cable diagram`}
        >
            <defs>
                <linearGradient id="pc-panel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#1e2028" />
                    <stop offset="100%" stopColor="#161820" />
                </linearGradient>
                {/* Glow filter for active socket rings */}
                <filter id="pc-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* ── Machine front panel ──────────────────────────────── */}
            <rect
                x={50} y={108} width={260} height={90} rx={8}
                fill="url(#pc-panel)"
                stroke="rgba(255,255,255,0.09)"
                strokeWidth={1}
            />
            {/* Brand strip */}
            <rect x={50} y={108} width={260} height={20} rx={8} fill="rgba(255,107,0,0.06)" />
            <text
                x={180} y={122} textAnchor="middle"
                fontSize={7} fill="#374151"
                letterSpacing="2.5" fontFamily="monospace" fontWeight="700"
            >
                VULCAN OMNIPRO 220
            </text>

            {/* ── Sockets ──────────────────────────────────────────── */}
            {/* Positive (+) socket */}
            <circle cx={130} cy={180} r={20} fill="#0c0d10" stroke={plusColor} strokeWidth={2} filter="url(#pc-glow)" />
            <circle cx={130} cy={180} r={12} fill="#13151a" stroke={plusColor} strokeWidth={1.5} opacity={0.7} />
            <text
                x={130} y={185} textAnchor="middle"
                fontSize={13} fill={plusColor} fontWeight="bold" fontFamily="monospace"
            >+</text>
            <text
                x={130} y={210} textAnchor="middle"
                fontSize={6.5} fill={plusColor} fontFamily="monospace" letterSpacing="1" opacity={0.75}
            >POS</text>

            {/* Negative (−) socket */}
            <circle cx={230} cy={180} r={20} fill="#0c0d10" stroke={minusColor} strokeWidth={2} filter="url(#pc-glow)" />
            <circle cx={230} cy={180} r={12} fill="#13151a" stroke={minusColor} strokeWidth={1.5} opacity={0.7} />
            <text
                x={230} y={185} textAnchor="middle"
                fontSize={13} fill={minusColor} fontWeight="bold" fontFamily="monospace"
            >−</text>
            <text
                x={230} y={210} textAnchor="middle"
                fontSize={6.5} fill={minusColor} fontFamily="monospace" letterSpacing="1" opacity={0.75}
            >NEG</text>

            {/* ── Device boxes ─────────────────────────────────────── */}
            {/* Left — gun / torch / electrode */}
            <rect x={40} y={16} width={130} height={46} rx={6}
                fill="#1a1c22" stroke="rgba(255,255,255,0.07)" strokeWidth={1}
            />
            <text
                x={105} y={35} textAnchor="middle"
                fontSize={7.5} fill="#9ca3af" fontFamily="monospace" letterSpacing="1.5" fontWeight="600"
            >{deviceLabel}</text>
            {/* Connection dot with polarity symbol */}
            <circle cx={105} cy={51} r={7} fill={cfg.leftColor} opacity={0.9} />
            <text
                x={105} y={55} textAnchor="middle"
                fontSize={8} fill="#000" fontFamily="monospace" fontWeight="800"
            >{cfg.leftSocket}</text>

            {/* Right — work clamp */}
            <rect x={190} y={16} width={130} height={46} rx={6}
                fill="#1a1c22" stroke="rgba(255,255,255,0.07)" strokeWidth={1}
            />
            <text
                x={255} y={35} textAnchor="middle"
                fontSize={7.5} fill="#9ca3af" fontFamily="monospace" letterSpacing="1.5" fontWeight="600"
            >WORK CLAMP</text>
            <circle cx={255} cy={51} r={7} fill={cfg.rightColor} opacity={0.9} />
            <text
                x={255} y={55} textAnchor="middle"
                fontSize={8} fill="#000" fontFamily="monospace" fontWeight="800"
            >{cfg.rightSocket}</text>

            {/* ── Animated cable paths ──────────────────────────────── */}
            {/* Left cable — gun/torch to its socket */}
            <path d={cfg.leftPath}  style={cableStyle(cfg.leftColor, 0)} />
            {/* Right cable — clamp to its socket, slight stagger */}
            <path d={cfg.rightPath} style={cableStyle(cfg.rightColor, 0.06)} />

            {/* ── Mode label watermark ──────────────────────────────── */}
            <text
                x={180} y={160} textAnchor="middle"
                fontSize={11} fill="rgba(255,255,255,0.04)"
                fontFamily="monospace" fontWeight="900" letterSpacing="6"
            >{mode}</text>
        </svg>
    );
}

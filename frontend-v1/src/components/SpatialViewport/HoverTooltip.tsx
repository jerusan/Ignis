import React from 'react';
import type { SpatialControlPoint } from '../../types/chat';

interface HoverTooltipProps {
    tooltipPoint: SpatialControlPoint;
    isLockedTooltip: boolean;
    style: React.CSSProperties;
}

export const HoverTooltip: React.FC<HoverTooltipProps> = ({
    tooltipPoint,
    isLockedTooltip,
    style,
}) => {
    return (
        <div style={style}>
            <div className="w-[218px] rounded-lg overflow-hidden shadow-[0_0_0_1px_rgba(245,158,11,0.5),0_8px_32px_rgba(0,0,0,0.85)]">
                <div className="flex items-center justify-between bg-amber-500/10 border-b border-amber-500/30 px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${isLockedTooltip ? 'bg-amber-400 animate-pulse' : 'bg-zinc-500'}`} />
                        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-amber-400">
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
    );
};
export default HoverTooltip;

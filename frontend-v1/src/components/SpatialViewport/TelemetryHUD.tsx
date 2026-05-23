import React from 'react';
import type { WelderTelemetry } from '../../types/chat';

interface TelemetryHUDProps {
    telemetry: WelderTelemetry;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ telemetry }) => {
    return (
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
    );
};
export default TelemetryHUD;

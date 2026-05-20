import React from 'react';
import { MicIcon, MicOffIcon, LoaderIcon } from 'lucide-react';
export type VoiceState = 'idle' | 'recording' | 'processing' | 'disabled';
export interface VoiceButtonProps {
  state?: VoiceState;
  onClick?: () => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}
const SIZE = {
  sm: {
    btn: 'w-8 h-8',
    icon: 'w-4 h-4',
    ring: 'inset-[-4px]'
  },
  md: {
    btn: 'w-10 h-10',
    icon: 'w-5 h-5',
    ring: 'inset-[-6px]'
  },
  lg: {
    btn: 'w-14 h-14',
    icon: 'w-6 h-6',
    ring: 'inset-[-8px]'
  }
};
function VoiceButton({
  state = 'idle',
  onClick,
  label,
  size = 'md'
}: VoiceButtonProps) {
  const s = SIZE[size];
  const disabled = state === 'disabled';
  const colorClass =
  state === 'recording' ?
  'bg-error text-white hover:bg-error-hover' :
  state === 'processing' ?
  'bg-info text-white' :
  state === 'disabled' ?
  'bg-background-subtle text-foreground-subtle cursor-not-allowed' :
  'bg-primary text-white hover:bg-primary-hover';
  const ariaLabel =
  label ?? (
  state === 'recording' ?
  'Stop recording' :
  state === 'processing' ?
  'Processing transcript' :
  state === 'disabled' ?
  'Voice input unavailable' :
  'Start voice input');
  return (
    <div className="relative inline-flex items-center justify-center">
      {state === 'recording' &&
      <span
        className={`absolute ${s.ring} rounded-full border-2 border-error/60 animate-ping pointer-events-none`}
        aria-hidden="true" />

      }
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={state === 'recording'}
        className={`${s.btn} relative rounded-full flex items-center justify-center transition-colors shadow-sm ${colorClass}`}>
        
        {state === 'processing' ?
        <LoaderIcon className={`${s.icon} animate-spin`} /> :
        state === 'disabled' ?
        <MicOffIcon className={s.icon} /> :

        <MicIcon className={s.icon} />
        }
      </button>
    </div>);

}
export default VoiceButton;
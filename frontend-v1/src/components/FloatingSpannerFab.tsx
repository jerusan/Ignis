import { useWorkbench } from './WorkbenchOverlay';

export function FloatingSpannerFab() {
  const { toggleOpen, isOpen } = useWorkbench();

  return (
    <button
      onClick={toggleOpen}
      title={isOpen ? 'Close workbench' : 'Open workbench'}
      aria-label={isOpen ? 'Close workbench panel' : 'Open workbench panel'}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
                 flex items-center justify-center text-white
                 transition-all duration-200
                 hover:scale-110 active:scale-95"
      style={{
        backgroundColor: isOpen ? '#e55f00' : '#ff6b00',
        boxShadow: '0 4px 24px rgba(255, 107, 0, 0.45)',
      }}
    >
      <WrenchIcon />
    </button>
  );
}

function WrenchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

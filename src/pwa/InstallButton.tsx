import { Download } from 'lucide-react';
import { usePWA } from './usePWA';

const LOOKS = {
  /** On the dark landing page and dashboard header. */
  onDark: 'border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20',
  /** On the light Desk screens. */
  light: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100',
} as const;

/**
 * Persistent "Install app" pill. Renders nothing once installed or when the browser offers no way to
 * install, so it is safe to drop into any header or menu.
 * Icon-only on phones, icon + label from `sm` up; `block` = full-width row with the label always shown.
 */
export default function InstallButton({
  className = '',
  tone = 'onDark',
  block = false,
}: {
  className?: string;
  tone?: keyof typeof LOOKS;
  block?: boolean;
}) {
  const { installed, canInstallHere, requestInstall } = usePWA();
  if (installed || !canInstallHere) return null;
  const size = block ? 'w-full min-h-11 justify-center px-4 text-sm' : 'h-9 px-2.5 text-sm sm:px-3.5';
  return (
    <button
      type="button"
      onClick={() => void requestInstall()}
      aria-label="Install the Samuhia Desk app"
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors ${size} ${LOOKS[tone]} ${className}`}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      <span className={block ? '' : 'hidden sm:inline'}>Install app</span>
    </button>
  );
}

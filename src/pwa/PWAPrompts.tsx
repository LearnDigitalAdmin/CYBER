import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, RefreshCw, X } from 'lucide-react';
import { usePWA } from './usePWA';
import { installSteps } from './installSteps';

const INSTALL_BENEFITS = [
  'Open Samuhia Desk straight from your home screen',
  'Loads faster, even on a slow network',
  'Updates only when you choose to',
];

const BrandMark = ({ size = 44 }: { size?: number }) => (
  <img src="/icons/apple-icon-180.png" alt="" width={size} height={size} className="shrink-0 rounded-xl" style={{ width: size, height: size }} />
);

const rise = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.98 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};

/** Where the install banner may appear: landing, sign-in chooser and signed-in areas. Never over sign-up, upload, form or service screens. */
function bannerAllowed(path: string) {
  return path === '/' || path === '/signin' || path.startsWith('/dashboard') || path.startsWith('/desk');
}

/**
 * Keep the stack clear of each screen's own fixed controls: the Desk bottom tab bar, and the round
 * floating action button on the landing page and dashboard.
 */
function stackPosition(path: string) {
  if (path.startsWith('/desk')) return 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6';
  if (path === '/') return 'bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(7rem+env(safe-area-inset-bottom,0px))]';
  if (path.startsWith('/dashboard')) return 'bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(7rem+env(safe-area-inset-bottom,0px))]';
  return 'bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] md:bottom-6';
}

function UpdateToast() {
  const { updateReady, applyUpdate } = usePWA();
  return (
    <AnimatePresence>
      {updateReady && (
        <motion.div
          key="update"
          role="status"
          {...rise}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0B1210] p-3 pl-4 text-white shadow-2xl shadow-black/40"
        >
          <RefreshCw className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-medium">A new version of Samuhia Desk is ready.</p>
          <button
            type="button"
            onClick={applyUpdate}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-cyan-400"
          >
            Update
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InstallBanner({ pathname }: { pathname: string }) {
  const { installed, canPrompt, canInstallHere, requestInstall, openSheet, dismissBanner, isBannerSnoozed } = usePWA();
  const [ready, setReady] = useState(false);

  // Give the page a moment to settle before asking for anything.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  const show = ready && !installed && canInstallHere && bannerAllowed(pathname) && !isBannerSnoozed();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="install"
          role="dialog"
          aria-label="Install Samuhia Desk"
          {...rise}
          className="rounded-2xl border border-white/10 bg-[#0B1210] p-4 text-white shadow-2xl shadow-black/40"
        >
          <div className="flex items-start gap-3">
            <BrandMark />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Install Samuhia Desk on your device</p>
              <ul className="mt-1 space-y-0.5 text-xs text-gray-400">
                {INSTALL_BENEFITS.map((b) => (
                  <li key={b} className="flex gap-1.5">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => (canPrompt ? void requestInstall() : openSheet())}
              className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-cyan-400"
            >
              {canPrompt ? 'Install app' : 'How to install'}
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              className="rounded-xl px-4 text-sm font-semibold text-gray-300 hover:bg-white/10"
            >
              Not now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InstallSheet() {
  const { sheetOpen, closeSheet, platform, browser, inAppBrowser } = usePWA();
  const { title, steps, note } = installSteps({ platform, browser, inAppBrowser });
  return (
    <AnimatePresence>
      {sheetOpen && (
        <motion.div
          key="sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 md:items-center"
          onClick={closeSheet}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full rounded-t-2xl border border-white/10 bg-[#0B1210] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-white shadow-2xl md:max-w-md md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <BrandMark />
              <h2 className="flex-1 text-lg font-semibold">{title}</h2>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-300">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {note && <p className="mt-4 text-xs text-gray-500">{note}</p>}
            <button
              type="button"
              onClick={closeSheet}
              className="mt-5 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-cyan-400"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Mount once, inside BrowserRouter. The update toast and install banner share one stack so they never overlap.
 * The toast shows on every screen (an update should never go unnoticed); the banner only where it can't
 * interrupt a form or OTP step.
 */
export default function PWAPrompts() {
  const { pathname } = useLocation();
  return (
    <>
      <div className={`pointer-events-none fixed inset-x-3 z-[60] flex flex-col gap-2 md:inset-x-auto md:right-6 md:w-96 ${stackPosition(pathname)}`}>
        <div className="pointer-events-auto flex flex-col gap-2">
          <UpdateToast />
          <InstallBanner pathname={pathname} />
        </div>
      </div>
      <InstallSheet />
    </>
  );
}

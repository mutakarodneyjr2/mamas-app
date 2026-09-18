import { useEffect } from 'react';

export type ModalCloseFn = () => boolean | void;

interface ModalEntry {
  id: string;
  close: ModalCloseFn;
}

// In-memory stack of open modals and sheets
const modalStack: ModalEntry[] = [];

/**
 * Registers an open modal onto the top of the stack.
 * Returns an unregister function to remove it when unmounted or closed.
 */
export function pushModal(id: string, close: ModalCloseFn): () => void {
  // Remove existing entry with same id if already present
  const existingIdx = modalStack.findIndex((m) => m.id === id);
  if (existingIdx !== -1) {
    modalStack.splice(existingIdx, 1);
  }
  modalStack.push({ id, close });

  return () => {
    popModal(id);
  };
}

/**
 * Removes a modal from the stack by id or pops the top.
 */
export function popModal(id?: string) {
  if (!id) {
    modalStack.pop();
    return;
  }
  const idx = modalStack.findIndex((m) => m.id === id);
  if (idx !== -1) {
    modalStack.splice(idx, 1);
  }
}

/**
 * Returns true if any modal or drawer is currently open.
 */
export function isAnyModalOpen(): boolean {
  return modalStack.length > 0;
}

/**
 * Attempts to close the topmost open modal.
 * Returns true if a modal was closed, false if stack was empty.
 */
export function closeTopModal(): boolean {
  if (modalStack.length > 0) {
    const top = modalStack.pop();
    if (top && typeof top.close === 'function') {
      try {
        top.close();
      } catch (err) {
        console.warn('[nativeBack] Error closing top modal:', err);
      }
      return true;
    }
  }
  return false;
}

/**
 * React hook to register a modal/sheet with the native hardware back stack.
 */
export function useRegisterModal(isOpen: boolean, onClose: () => void, idPrefix = 'modal') {
  useEffect(() => {
    if (!isOpen) return;
    const id = `${idPrefix}_${Math.random().toString(36).substring(2, 9)}`;
    const unregister = pushModal(id, onClose);
    return () => {
      unregister();
    };
  }, [isOpen, onClose, idPrefix]);
}

// Toast notification helper for double-back exit confirmation
let exitToastTimeout: any = null;
function showExitToast(message: string) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('native-exit-toast');
  if (existing) existing.remove();
  if (exitToastTimeout) clearTimeout(exitToastTimeout);

  const toast = document.createElement('div');
  toast.id = 'native-exit-toast';
  toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/90 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700/80 backdrop-blur-md pointer-events-none transition-opacity duration-200 animate-in fade-in';
  toast.textContent = message;
  document.body.appendChild(toast);

  exitToastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

let capAppPlugin: any = null;
async function getCapacitorAppPlugin() {
  if (capAppPlugin) return capAppPlugin;
  if (typeof window === 'undefined') return null;

  // 1. Check window.Capacitor.Plugins.App
  const cap = (window as any).Capacitor;
  if (cap?.Plugins?.App) {
    capAppPlugin = cap.Plugins.App;
    return capAppPlugin;
  }

  // 2. Dynamic import if @capacitor/app is bundled
  try {
    const mod = await (Function('return import("@capacitor/app")')() as Promise<any>);
    if (mod?.App) {
      capAppPlugin = mod.App;
      return capAppPlugin;
    }
  } catch {
    // Package not installed yet or in web browser
  }
  return null;
}

// Root shell paths where hardware back shouldn't randomly navigate or exit immediately
const ROOT_SHELL_PATHS = new Set([
  '/',
  '/dashboard',
  '/login',
  '/register',
  '/pending-approval'
]);

let lastBackPressTime = 0;

/**
 * Initializes native Android / Capacitor hardware back button and deep link listeners.
 * Safe to execute in both web browser and Capacitor native environments.
 */
export function setupNativeBack(
  navigate: (to: string | number, options?: any) => void,
  currentPathname: () => string
) {
  let isCleanedUp = false;

  // Setup Capacitor App plugin listeners
  getCapacitorAppPlugin().then((CapApp) => {
    if (!CapApp || isCleanedUp) return;

    // 1. Back button listener
    if (typeof CapApp.addListener === 'function') {
      CapApp.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
        // Priority A: Close top modal if any is open
        if (isAnyModalOpen()) {
          closeTopModal();
          return;
        }

        const path = currentPathname();
        const isRootShell = ROOT_SHELL_PATHS.has(path);

        // Priority B: If not on a root shell, navigate back in history
        if (!isRootShell && canGoBack) {
          navigate(-1);
          return;
        }

        // Priority C: At true root shell, require double-back within 2s to exit
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
          if (typeof CapApp.exitApp === 'function') {
            CapApp.exitApp();
          }
        } else {
          lastBackPressTime = now;
          showExitToast('Press back again to exit MAMAS');
        }
      });

      // 2. Deep link URL listener
      CapApp.addListener('appUrlOpen', ({ url }: { url: string }) => {
        if (!url) return;
        try {
          const parsed = new URL(url);
          const target = parsed.pathname + parsed.search;
          if (target && target !== '/') {
            navigate(target);
          }
        } catch (err) {
          console.warn('[nativeBack] Could not parse deep link URL:', url, err);
        }
      });
    }
  });

  return () => {
    isCleanedUp = true;
  };
}

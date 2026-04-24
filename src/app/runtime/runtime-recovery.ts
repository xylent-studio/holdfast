import { HOLDFAST_BUILD_ID } from '@/app/runtime/build';

const RUNTIME_RECOVERY_KEY = `holdfast-runtime-recovery:${HOLDFAST_BUILD_ID}`;
const CONTROLLER_RELOAD_KEY = `holdfast-controller-reload:${HOLDFAST_BUILD_ID}`;

export interface ServiceWorkerMetadata {
  buildId: string;
  cacheName: string;
}

function isWindowAvailable(): boolean {
  return typeof window !== 'undefined';
}

function sessionValue(key: string): string | null {
  if (!isWindowAvailable()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionValue(key: string, value: string): void {
  if (!isWindowAvailable()) {
    return;
  }

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore private-mode/session-storage failures and keep the app moving.
  }
}

export function clearRuntimeRecoveryAttempt(): void {
  if (!isWindowAvailable()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(RUNTIME_RECOVERY_KEY);
    window.sessionStorage.removeItem(CONTROLLER_RELOAD_KEY);
  } catch {
    // Ignore private-mode/session-storage failures and keep the app moving.
  }
}

export function shouldReloadForControllerChange(): boolean {
  return !sessionValue(CONTROLLER_RELOAD_KEY);
}

export function markControllerReloaded(): void {
  setSessionValue(CONTROLLER_RELOAD_KEY, '1');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return '';
}

export function isRecoverableRuntimeError(error: unknown): boolean {
  const message = errorMessage(error);

  return [
    /chunkloaderror/i,
    /failed to fetch dynamically imported module/i,
    /importing a module script failed/i,
    /failed to load module script/i,
    /loading chunk [\w-]+ failed/i,
  ].some((pattern) => pattern.test(message));
}

export async function requestServiceWorkerMetadata(
  controller: ServiceWorker | null | undefined,
): Promise<ServiceWorkerMetadata | null> {
  if (!controller) {
    return null;
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(null), 500);

    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve((event.data as ServiceWorkerMetadata | null) ?? null);
    };

    try {
      controller.postMessage({ type: 'HOLDFAST_GET_METADATA' }, [channel.port2]);
    } catch {
      window.clearTimeout(timeout);
      resolve(null);
    }
  });
}

export async function clearHoldfastRuntimeCaches(): Promise<void> {
  if (!('caches' in window)) {
    return;
  }

  const keys = await window.caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith('holdfast-shell-'))
      .map((key) => window.caches.delete(key)),
  );
}

export async function unregisterHoldfastServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map((registration) => registration.unregister()),
  );
}

function refreshCurrentLocation(): void {
  const currentUrl = window.location.href;
  window.setTimeout(() => {
    window.location.replace(currentUrl);
  }, 0);
}

function scheduleRuntimeRefresh(): void {
  if (document.readyState === 'complete') {
    refreshCurrentLocation();
    return;
  }

  window.addEventListener('load', refreshCurrentLocation, {
    once: true,
  });
}

export async function repairRuntimeOnce(
  reason: string,
): Promise<'already-attempted' | 'started' | 'unsupported'> {
  if (!isWindowAvailable() || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }

  if (sessionValue(RUNTIME_RECOVERY_KEY)) {
    return 'already-attempted';
  }

  setSessionValue(RUNTIME_RECOVERY_KEY, reason);

  await unregisterHoldfastServiceWorkers();
  await clearHoldfastRuntimeCaches();
  scheduleRuntimeRefresh();
  return 'started';
}

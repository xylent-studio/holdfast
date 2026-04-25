import { HOLDFAST_BUILD_ID } from '@/app/runtime/build';
import {
  isRecoverableRuntimeError,
  markControllerReloaded,
  repairRuntimeOnce,
  requestServiceWorkerMetadata,
  shouldReloadForControllerChange,
} from '@/app/runtime/runtime-recovery';

function runtimeErrorPayload(
  event: ErrorEvent | PromiseRejectionEvent,
): unknown {
  if ('reason' in event) {
    return event.reason;
  }

  return event.error ?? event.message;
}

async function maybeRepairActiveController(): Promise<void> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return;
  }

  const metadata = await requestServiceWorkerMetadata(
    navigator.serviceWorker.controller,
  );
  if (metadata?.buildId === HOLDFAST_BUILD_ID) {
    return;
  }

  await repairRuntimeOnce(
    metadata ? 'controller-build-mismatch' : 'legacy-controller',
  );
}

function installRuntimeGuards(): void {
  const handleRuntimeFailure = (payload: unknown): void => {
    if (!isRecoverableRuntimeError(payload)) {
      return;
    }

    void repairRuntimeOnce('runtime-error');
  };

  window.addEventListener('error', (event) => {
    handleRuntimeFailure(runtimeErrorPayload(event));
  });

  window.addEventListener('unhandledrejection', (event) => {
    handleRuntimeFailure(runtimeErrorPayload(event));
  });
}

async function registerServiceWorker(): Promise<void> {
  const hadController = Boolean(navigator.serviceWorker.controller);
  const registration = await navigator.serviceWorker.register('/sw.js');
  if (!registration) {
    return;
  }

  const triggerSkipWaiting = (worker: ServiceWorker | null): void => {
    worker?.postMessage({ type: 'HOLDFAST_SKIP_WAITING' });
  };

  const watchInstallingWorker = (worker: ServiceWorker | null): void => {
    if (!worker) {
      return;
    }

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        triggerSkipWaiting(worker);
      }
    });
  };

  if (registration.waiting && navigator.serviceWorker.controller) {
    triggerSkipWaiting(registration.waiting);
  }
  watchInstallingWorker(registration.installing);

  registration.addEventListener('updatefound', () => {
    watchInstallingWorker(registration.installing);
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      return;
    }

    if (!shouldReloadForControllerChange()) {
      return;
    }

    markControllerReloaded();
    window.location.reload();
  });
}

export async function startHoldfastRuntime(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  installRuntimeGuards();

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  await maybeRepairActiveController();

  window.addEventListener('load', () => {
    void registerServiceWorker().catch((error) => {
      console.error('Service worker registration failed', error);
    });
  });
}

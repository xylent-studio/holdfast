import { useEffect, useState } from 'react';

import {
  HOLDFAST_BUILD_ID,
  HOLDFAST_SUPABASE_HOST,
} from '@/app/runtime/build';
import { requestServiceWorkerMetadata } from '@/app/runtime/runtime-recovery';

export function useRuntimeDiagnostics() {
  const [activeServiceWorkerBuildId, setActiveServiceWorkerBuildId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let cancelled = false;

    const refresh = async (): Promise<void> => {
      const metadata = await requestServiceWorkerMetadata(
        navigator.serviceWorker.controller,
      );

      if (cancelled) {
        return;
      }

      setActiveServiceWorkerBuildId(metadata?.buildId ?? null);
    };

    void refresh();
    navigator.serviceWorker.addEventListener('controllerchange', refresh);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', refresh);
    };
  }, []);

  return {
    activeServiceWorkerBuildId,
    buildId: HOLDFAST_BUILD_ID,
    supabaseHost: HOLDFAST_SUPABASE_HOST || null,
  };
}

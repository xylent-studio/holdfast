import type { SyncBootstrapStatus, SyncProviderConfig } from '@/storage/sync/contracts';

export function getSupabaseSyncConfig(): SyncProviderConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return {
    provider: 'supabase',
    url,
    anonKey,
  };
}

export function getSupabaseSyncStatus(): SyncBootstrapStatus {
  const config = getSupabaseSyncConfig();
  if (!config) {
    return {
      configured: false,
      reason: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
    };
  }

  return { configured: true };
}

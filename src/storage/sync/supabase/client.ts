import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseSyncConfig } from '@/storage/sync/supabase/config';

let browserClient: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient !== undefined) {
    return browserClient;
  }

  const config = getSupabaseSyncConfig();
  if (!config) {
    browserClient = null;
    return browserClient;
  }

  browserClient = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });

  return browserClient;
}

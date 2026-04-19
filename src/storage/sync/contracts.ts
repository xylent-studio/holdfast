export type SyncProvider = 'supabase';

export type SyncMode = 'disabled' | 'ready' | 'syncing' | 'error';

export interface SyncProviderConfig {
  provider: SyncProvider;
  url: string;
  anonKey: string;
}

export interface SyncBootstrapStatus {
  configured: boolean;
  reason?: string;
}

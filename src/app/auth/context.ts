import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthContextValue {
  configured: boolean;
  displayName: string | null;
  email: string | null;
  error: string | null;
  isReady: boolean;
  magicLinkSentTo: string | null;
  providerLabel: string | null;
  session: Session | null;
  user: User | null;
  clearFeedback: () => void;
  continueWithGoogle: (nextPath?: string) => Promise<void>;
  sendMagicLink: (email: string, nextPath?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

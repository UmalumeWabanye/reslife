import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore, type Tokens } from './api';
import type { Me, Residency } from './types';

interface SessionState {
  isLoading: boolean;
  me: Me | null;
  residency: Residency | null;
  /** Student still needs to fill in their name and funding type. */
  needsProfile: boolean;
  signIn: (tokens: Tokens) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-fetch user + residency, e.g. after accepting an offer (flips the app into residence mode). */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [residency, setResidency] = useState<Residency | null>(null);

  const clear = useCallback(() => {
    setMe(null);
    setResidency(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const user = await api.get<Me>('/auth/me');
      if (user.role !== 'STUDENT') {
        // This app is for students only; landlords/admins use the web dashboard.
        await tokenStore.clear();
        clear();
        return;
      }
      const res = await api.get<Residency>('/me/residency');
      setMe(user);
      setResidency(res);
    } catch {
      if (!tokenStore.current) clear();
    }
  }, [clear]);

  useEffect(() => {
    tokenStore.onSignedOut(clear);
    (async () => {
      if (await tokenStore.load()) await load();
      setLoading(false);
    })();
  }, [clear, load]);

  const value = useMemo<SessionState>(
    () => ({
      isLoading,
      me,
      residency,
      needsProfile: !!me && (!me.firstName || !me.lastName || !me.studentProfile?.fundingType),
      signIn: async (tokens) => {
        await tokenStore.save(tokens);
        await load();
      },
      signOut: async () => {
        const refreshToken = tokenStore.current?.refreshToken;
        if (refreshToken) api.post('/auth/logout', { refreshToken }).catch(() => {});
        await tokenStore.clear();
        clear();
      },
      refresh: load,
    }),
    [isLoading, me, residency, load, clear],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

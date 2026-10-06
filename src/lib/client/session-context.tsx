'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

export interface SessionUser {
  id: string; email: string; firstName: string; lastName: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  classLevelId: string | null; classLevel?: { code: string; name: string } | null; establishment: string | null; region: string | null; locale: string;
  unreadNotifications?: number;
}

interface Ctx { user: SessionUser | null; loading: boolean; refresh: () => Promise<void>; setUser: (u: SessionUser | null) => void }
const SessionContext = createContext<Ctx>({ user: null, loading: true, refresh: async () => {}, setUser: () => {} });

export function SessionProvider({ initialUser, children }: { initialUser: SessionUser | null; children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setUser(await api.get<SessionUser | null>('/auth/me')); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (initialUser) refresh(); }, [initialUser, refresh]);
  return <SessionContext.Provider value={{ user, loading, refresh, setUser }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

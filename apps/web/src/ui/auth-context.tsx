import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { type SessionDto, type LoginInput, type RegisterInput } from '@edutube/contracts';
import { api, setCsrfToken, onSessionLost } from '../adapters/http/runtime';
import { flushPendingChanges } from '../application/pending-changes';
import { HttpError } from '../adapters/http/client';
interface AuthContext {
  session: SessionDto | null;
  loading: boolean;
  error: string;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}
const Context = createContext<AuthContext | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => onSessionLost(() => setSession(null)), []);
  useEffect(() => {
    if (!session) {
      return;
    }
    const timer = setTimeout(
      () => {
        setSession(null);
        setCsrfToken(undefined);
      },
      Math.max(0, new Date(session.expiresAt).getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);
  useEffect(() => {
    const controller = new AbortController();
    api.auth
      .session({ signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        setSession(result);
        setCsrfToken(result.csrfToken);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (!(failure instanceof HttpError && failure.status === 401)) {
          setError('Impossible de vérifier votre session. Rechargez la page pour réessayer.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);
  const authenticate = async (request: Promise<SessionDto>) => {
    const result = await request;
    setCsrfToken(result.csrfToken);
    setSession(result);
    setError('');
  };
  const logout = async () => {
    await flushPendingChanges();
    try {
      await api.auth.logout();
    } catch (failure) {
      if (!(failure instanceof HttpError && failure.status === 401)) {
        throw failure;
      }
    }
    setCsrfToken(undefined);
    setSession(null);
  };
  return (
    <Context.Provider
      value={{
        session,
        loading,
        error,
        login: (input) => authenticate(api.auth.login(input)),
        register: (input) => authenticate(api.auth.register(input)),
        logout,
        refresh: async () => {
          try {
            await authenticate(api.auth.session());
          } catch (failure) {
            if (failure instanceof HttpError && failure.status === 401) {
              setSession(null);
              setCsrfToken(undefined);
            } else {
              throw failure;
            }
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) {
    throw new Error('AuthProvider manquant');
  }
  return context;
}
export function RequireSession() {
  const { session, loading, error } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <p className="container section" role="status">
        Vérification de votre session…
      </p>
    );
  }
  if (error) {
    return (
      <p className="container section" role="alert">
        {error}
      </p>
    );
  }
  return session ? (
    <Outlet />
  ) : (
    <Navigate
      replace
      to={`/connexion?retour=${encodeURIComponent(location.pathname + location.search)}`}
    />
  );
}
export function returnPath(value: string | null) {
  return value &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !Array.from(value).some((character) => character.charCodeAt(0) < 32) &&
    !value.startsWith('/connexion')
    ? value
    : '/mon-espace';
}

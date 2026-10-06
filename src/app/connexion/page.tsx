'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useSession } from '@/lib/client/session-context';
import { Field, Alert } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { setUser, refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const u = await api.post<Parameters<typeof setUser>[0]>('/auth/login', { email, password });
      setUser(u); await refresh();
      const next = sp.get('suite') ?? (u?.role === 'ADMIN' ? '/admin' : '/mon-espace');
      router.push(next); router.refresh();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card mx-auto mt-6 max-w-md space-y-4 p-6" aria-labelledby="login-title">
      <h1 id="login-title" className="text-xl font-bold">Se connecter</h1>
      {sp.get('suite') && <Alert kind="info">Connectez-vous pour accéder à cette page.</Alert>}
      {sp.get('erreur') && <Alert kind="error">{sp.get('erreur')}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <Field label="Adresse e-mail" htmlFor="email" required><input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required /></Field>
      <Field label="Mot de passe" htmlFor="password" required><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required /></Field>
      <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      <div className="flex items-center gap-3 text-xs text-simen-gray-mid"><span className="h-px flex-1 bg-simen-gray-light" /><span>ou</span><span className="h-px flex-1 bg-simen-gray-light" /></div>
      <a href="/api/v1/auth/sso/login" className="btn-secondary w-full">Se connecter avec le SSO</a>
      <p className="text-center text-sm text-simen-gray">Pas encore de compte ? <Link href="/inscription" className="font-semibold text-simen-blue hover:underline">Créer un compte</Link></p>
      <p className="text-center text-xs text-simen-gray-mid">Mot de passe oublié ? Adressez-vous à votre établissement ou à votre IEF, qui contactera l’administrateur de la plateforme.</p>
    </form>
  );
}

export default function ConnexionPage() {
  return <Suspense><LoginForm /></Suspense>;
}

'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage, ApiClientError } from '@/lib/client/api';
import { useSession } from '@/lib/client/session-context';
import { useTaxonomy } from '@/components/forms/TaxonomySelects';
import { Field, Alert } from '@/components/ui';
import { REGIONS_SENEGAL } from '@/lib/utils';

export default function InscriptionPage() {
  const router = useRouter();
  const { setUser, refresh } = useSession();
  const tax = useTaxonomy();
  const [f, setF] = useState({ role: 'STUDENT', firstName: '', lastName: '', email: '', password: '', classLevelId: '', establishment: '', region: '', ief: '', ia: '', charte: false });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null); setErrors({});
    try {
      const u = await api.post<Parameters<typeof setUser>[0]>('/auth/register', { ...f, classLevelId: f.role === 'STUDENT' ? f.classLevelId || null : null });
      setUser(u); await refresh(); router.push('/mon-espace?bienvenue=1'); router.refresh();
    } catch (err) { if (err instanceof ApiClientError && err.details) setErrors(err.details); setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card mx-auto mt-6 max-w-2xl space-y-5 p-6">
      <h1 className="text-xl font-bold">Créer un compte</h1>
      <p className="text-sm text-simen-gray">Réservé aux élèves et aux enseignants du système éducatif sénégalais. Les comptes administrateurs sont créés par le Ministère.</p>
      {error && <Alert kind="error">{error}</Alert>}
      <fieldset>
        <legend className="label">Je suis</legend>
        <div className="flex gap-4 text-sm">
          {[['STUDENT', 'Élève'], ['TEACHER', 'Enseignant(e)']].map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="radio" name="role" value={v} checked={f.role === v} onChange={() => up({ role: v })} className="accent-simen-blue" />{l}</label>)}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="firstName" required error={errors.firstName?.[0]}><input id="firstName" value={f.firstName} onChange={(e) => up({ firstName: e.target.value })} className="input" required autoComplete="given-name" /></Field>
        <Field label="Nom" htmlFor="lastName" required error={errors.lastName?.[0]}><input id="lastName" value={f.lastName} onChange={(e) => up({ lastName: e.target.value })} className="input" required autoComplete="family-name" /></Field>
        <Field label="Adresse e-mail" htmlFor="email" required error={errors.email?.[0]}><input id="email" type="email" value={f.email} onChange={(e) => up({ email: e.target.value })} className="input" required autoComplete="email" /></Field>
        <Field label="Mot de passe" htmlFor="password" required hint="8 caractères minimum" error={errors.password?.[0]}><input id="password" type="password" value={f.password} onChange={(e) => up({ password: e.target.value })} className="input" required minLength={8} autoComplete="new-password" /></Field>
        {f.role === 'STUDENT' && (
          <Field label="Classe" htmlFor="classLevelId" hint="Permet à vos enseignants de vous recommander des contenus" error={errors.classLevelId?.[0]}>
            <select id="classLevelId" value={f.classLevelId} onChange={(e) => up({ classLevelId: e.target.value })} className="input"><option value="">Choisir…</option>{tax?.cycles.map((c) => <optgroup key={c.id} label={c.name}>{c.classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}</optgroup>)}</select>
          </Field>
        )}
        <Field label="Établissement" htmlFor="establishment" hint="ex. Lycée Blaise Diagne, École élémentaire Ndiarème"><input id="establishment" value={f.establishment} onChange={(e) => up({ establishment: e.target.value })} className="input" /></Field>
        <Field label="Région" htmlFor="region"><select id="region" value={f.region} onChange={(e) => up({ region: e.target.value })} className="input"><option value="">Choisir…</option>{REGIONS_SENEGAL.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="IEF" htmlFor="ief" hint="Inspection de l’Éducation et de la Formation"><input id="ief" value={f.ief} onChange={(e) => up({ ief: e.target.value })} className="input" placeholder="ex. IEF Dakar-Plateau" /></Field>
        <Field label="IA (académie)" htmlFor="ia" hint="Inspection d’Académie"><input id="ia" value={f.ia} onChange={(e) => up({ ia: e.target.value })} className="input" placeholder="ex. IA de Dakar" /></Field>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={f.charte} onChange={(e) => up({ charte: e.target.checked })} className="mt-1 accent-simen-blue" /><span>J’ai lu et j’accepte la <Link href="/charte" className="font-semibold text-simen-blue hover:underline" target="_blank">charte communautaire</Link> de la plateforme.</span></label>
      <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
      <p className="text-center text-sm text-simen-gray">Déjà inscrit ? <Link href="/connexion" className="font-semibold text-simen-blue hover:underline">Se connecter</Link></p>
    </form>
  );
}

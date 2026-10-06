'use client';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useSession } from '@/lib/client/session-context';
import { useToast } from '@/lib/client/toast-context';
import { useTaxonomy } from '@/components/forms/TaxonomySelects';
import { Field, Spinner } from '@/components/ui';
import { REGIONS_SENEGAL, ROLE_LABELS } from '@/lib/utils';

interface Me { firstName: string; lastName: string; email: string; role: string; locale: string; classLevelId: string | null; establishment: string | null; region: string | null; ief: string | null; ia: string | null; bio: string | null }

export default function ProfilPage() {
  const { refresh } = useSession();
  const { toast } = useToast();
  const tax = useTaxonomy();
  const [me, setMe] = useState<Me | null>(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  useEffect(() => { api.get<Me>('/auth/me').then(setMe).catch(() => {}); }, []);
  if (!me) return <Spinner />;
  const up = (p: Partial<Me>) => setMe({ ...me, ...p });
  const save = async (e: React.FormEvent) => { e.preventDefault(); try { await api.patch('/auth/me', { firstName: me.firstName, lastName: me.lastName, locale: me.locale, classLevelId: me.classLevelId || null, establishment: me.establishment, region: me.region, ief: me.ief, ia: me.ia, bio: me.bio }); toast('Profil enregistré.', 'success'); refresh(); } catch (err) { toast(errorMessage(err), 'error'); } };
  const changePw = async (e: React.FormEvent) => { e.preventDefault(); if (pw.newPassword !== pw.confirm) return toast('Les mots de passe ne correspondent pas.', 'error'); try { await api.patch('/auth/me', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }); setPw({ currentPassword: '', newPassword: '', confirm: '' }); toast('Mot de passe modifié.', 'success'); } catch (err) { toast(errorMessage(err), 'error'); } };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mon profil</h1>
      <form onSubmit={save} className="card space-y-4 p-6">
        <p className="text-sm text-simen-gray">{me.email} · {ROLE_LABELS[me.role]}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="fn"><input id="fn" value={me.firstName} onChange={(e) => up({ firstName: e.target.value })} className="input" required /></Field>
          <Field label="Nom" htmlFor="ln"><input id="ln" value={me.lastName} onChange={(e) => up({ lastName: e.target.value })} className="input" required /></Field>
          {me.role === 'STUDENT' && <Field label="Classe" htmlFor="cl"><select id="cl" value={me.classLevelId ?? ''} onChange={(e) => up({ classLevelId: e.target.value })} className="input"><option value="">—</option>{tax?.cycles.map((c) => <optgroup key={c.id} label={c.name}>{c.classes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</select></Field>}
          <Field label="Établissement" htmlFor="et"><input id="et" value={me.establishment ?? ''} onChange={(e) => up({ establishment: e.target.value })} className="input" /></Field>
          <Field label="Région" htmlFor="rg"><select id="rg" value={me.region ?? ''} onChange={(e) => up({ region: e.target.value })} className="input"><option value="">—</option>{REGIONS_SENEGAL.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="IEF" htmlFor="ief"><input id="ief" value={me.ief ?? ''} onChange={(e) => up({ ief: e.target.value })} className="input" /></Field>
          <Field label="IA" htmlFor="ia"><input id="ia" value={me.ia ?? ''} onChange={(e) => up({ ia: e.target.value })} className="input" /></Field>
          <Field label="Langue préférée" htmlFor="loc"><select id="loc" value={me.locale} onChange={(e) => up({ locale: e.target.value })} className="input"><option value="fr">Français</option><option value="wo">Wolof</option><option value="ar">Arabe</option></select></Field>
        </div>
        <Field label="Présentation (visible sur votre chaîne, enseignants)" htmlFor="bio"><textarea id="bio" value={me.bio ?? ''} onChange={(e) => up({ bio: e.target.value })} className="input" rows={3} maxLength={500} /></Field>
        <button type="submit" className="btn-primary">Enregistrer</button>
      </form>
      <form onSubmit={changePw} className="card space-y-4 p-6">
        <h2 className="font-bold">Changer de mot de passe</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Mot de passe actuel" htmlFor="cp"><input id="cp" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className="input" required autoComplete="current-password" /></Field>
          <Field label="Nouveau mot de passe" htmlFor="np"><input id="np" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className="input" required minLength={8} autoComplete="new-password" /></Field>
          <Field label="Confirmation" htmlFor="cf"><input id="cf" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="input" required minLength={8} autoComplete="new-password" /></Field>
        </div>
        <button type="submit" className="btn-secondary">Modifier le mot de passe</button>
      </form>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { useTaxonomy } from '@/components/forms/TaxonomySelects';
import { Field, Modal, Pagination, Spinner, StatusBadge, Badge } from '@/components/ui';
import { formatDate, ROLE_LABELS, REGIONS_SENEGAL } from '@/lib/utils';

interface U { id: string; email: string; firstName: string; lastName: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT'; status: string; establishment: string | null; region: string | null; ief: string | null; ia: string | null; classLevelId: string | null; classLevel: { code: string } | null; createdAt: string; lastLoginAt: string | null; _count: { submissions: number; comments: number } }

export default function UtilisateursPage() {
  const { toast } = useToast();
  const tax = useTaxonomy();
  const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: U[]; meta: { total: number; pageSize: number } } | null>(null);
  const [edit, setEdit] = useState<U | null>(null);
  const [create, setCreate] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const load = useCallback(() => api.get<NonNullable<typeof data>>(`/admin/users?${new URLSearchParams({ q, role, page: String(page) })}`).then(setData).catch((e) => toast(errorMessage(e), 'error')), [q, role, page, toast]);
  useEffect(() => { load(); }, [load]);
  const save = async () => { if (!edit) return; try { await api.patch(`/admin/users/${edit.id}`, { role: form.role, status: form.status, classLevelId: form.classLevelId || null, establishment: form.establishment, region: form.region, ief: form.ief, ia: form.ia, ...(form.newPassword ? { newPassword: form.newPassword } : {}) }); toast('Utilisateur mis à jour.', 'success'); setEdit(null); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const doCreate = async () => { try { await api.post('/admin/users', { ...form, classLevelId: form.classLevelId || null }); toast('Compte créé.', 'success'); setCreate(false); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const classOptions = tax?.cycles.flatMap((c) => c.classes) ?? [];
  const UserForm = ({ withIdentity }: { withIdentity: boolean }) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {withIdentity && <><Field label="Prénom" htmlFor="u-fn"><input id="u-fn" value={form.firstName ?? ''} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" /></Field><Field label="Nom" htmlFor="u-ln"><input id="u-ln" value={form.lastName ?? ''} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" /></Field><Field label="E-mail" htmlFor="u-em"><input id="u-em" type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></Field><Field label="Mot de passe initial" htmlFor="u-pw"><input id="u-pw" type="text" value={form.password ?? ''} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" minLength={8} /></Field></>}
      <Field label="Rôle" htmlFor="u-role"><select id="u-role" value={form.role ?? 'STUDENT'} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input"><option value="STUDENT">Élève</option><option value="TEACHER">Enseignant</option><option value="ADMIN">Administrateur</option></select></Field>
      {!withIdentity && <Field label="Statut" htmlFor="u-st"><select id="u-st" value={form.status ?? 'ACTIVE'} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input"><option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option></select></Field>}
      <Field label="Classe (élève)" htmlFor="u-cl"><select id="u-cl" value={form.classLevelId ?? ''} onChange={(e) => setForm({ ...form, classLevelId: e.target.value })} className="input"><option value="">—</option>{classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Établissement" htmlFor="u-et"><input id="u-et" value={form.establishment ?? ''} onChange={(e) => setForm({ ...form, establishment: e.target.value })} className="input" /></Field>
      <Field label="Région" htmlFor="u-rg"><select id="u-rg" value={form.region ?? ''} onChange={(e) => setForm({ ...form, region: e.target.value })} className="input"><option value="">—</option>{REGIONS_SENEGAL.map((r) => <option key={r}>{r}</option>)}</select></Field>
      <Field label="IEF" htmlFor="u-ief"><input id="u-ief" value={form.ief ?? ''} onChange={(e) => setForm({ ...form, ief: e.target.value })} className="input" /></Field>
      <Field label="IA" htmlFor="u-ia"><input id="u-ia" value={form.ia ?? ''} onChange={(e) => setForm({ ...form, ia: e.target.value })} className="input" /></Field>
      {!withIdentity && <Field label="Réinitialiser le mot de passe" htmlFor="u-np" hint="Laisser vide pour ne pas changer"><input id="u-np" type="text" value={form.newPassword ?? ''} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className="input" minLength={8} /></Field>}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Utilisateurs</h1><button type="button" className="btn-primary" onClick={() => { setForm({ role: 'TEACHER' }); setCreate(true); }}>+ Créer un compte</button></div>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="card flex flex-wrap gap-2 p-3"><input value={q} onChange={(e) => setQ(e.target.value)} className="input max-w-xs" placeholder="Nom, e-mail, établissement…" aria-label="Rechercher" /><select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="input w-auto" aria-label="Rôle"><option value="">Tous les rôles</option><option value="ADMIN">Administrateurs</option><option value="TEACHER">Enseignants</option><option value="STUDENT">Élèves</option></select><button type="submit" className="btn-secondary">Rechercher</button>{data && <span className="ml-auto self-center text-sm text-simen-gray-mid">{data.meta.total} compte(s)</span>}</form>
      {!data ? <Spinner /> : (
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-simen-gray-lighter text-left text-xs uppercase text-simen-gray"><th className="p-3">Utilisateur</th><th className="p-3">Rôle</th><th className="p-3">Rattachement</th><th className="p-3">Activité</th><th className="p-3">Statut</th><th className="p-3"></th></tr></thead>
          <tbody>{data.items.map((u) => <tr key={u.id} className="border-b border-simen-gray-lighter hover:bg-simen-blue-light/30"><td className="p-3"><p className="font-semibold">{u.firstName} {u.lastName}</p><p className="text-xs text-simen-gray-mid">{u.email}</p></td><td className="p-3"><Badge color={u.role === 'ADMIN' ? 'blue' : u.role === 'TEACHER' ? 'orange' : 'gray'}>{ROLE_LABELS[u.role]}</Badge>{u.classLevel && <span className="ml-1 text-xs">{u.classLevel.code}</span>}</td><td className="p-3 text-xs">{[u.establishment, u.region, u.ief].filter(Boolean).join(' · ') || '—'}</td><td className="p-3 text-xs">{u._count.submissions} prop. · {u._count.comments} comm.<br />Inscrit le {formatDate(u.createdAt)}{u.lastLoginAt && <> · vu le {formatDate(u.lastLoginAt)}</>}</td><td className="p-3"><StatusBadge status={u.status} /></td><td className="p-3"><button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => { setEdit(u); setForm({ role: u.role, status: u.status, classLevelId: u.classLevelId ?? '', establishment: u.establishment ?? '', region: u.region ?? '', ief: u.ief ?? '', ia: u.ia ?? '' }); }}>Modifier</button></td></tr>)}</tbody></table></div>
      )}
      {data && <Pagination page={page} pageCount={Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize))} onChange={setPage} />}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Modifier ${edit?.firstName} ${edit?.lastName}`} wide><UserForm withIdentity={false} /><div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Annuler</button><button type="button" className="btn-primary" onClick={save}>Enregistrer</button></div></Modal>
      <Modal open={create} onClose={() => setCreate(false)} title="Créer un compte" wide><UserForm withIdentity /><div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setCreate(false)}>Annuler</button><button type="button" className="btn-primary" onClick={doCreate}>Créer</button></div></Modal>
    </div>
  );
}

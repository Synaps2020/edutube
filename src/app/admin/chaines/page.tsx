'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { Field, Modal, Spinner, Badge } from '@/components/ui';

interface Ch { id: string; slug: string; name: string; description: string | null; isOfficial: boolean; owner: { id: string; firstName: string; lastName: string; role: string }; _count: { media: number; subscribers: number } }

export default function ChainesAdminPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Ch[] | null>(null);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Ch | null>(null);
  const [form, setForm] = useState({ name: '', description: '', isOfficial: true, ownerId: '' });
  const [owners, setOwners] = useState<Array<{ id: string; firstName: string; lastName: string; role: string }>>([]);
  const load = useCallback(() => api.get<Ch[]>('/admin/channels').then(setItems).catch((e) => toast(errorMessage(e), 'error')), [toast]);
  useEffect(() => { load(); api.get<{ items: typeof owners }>('/admin/users?pageSize=100&role=TEACHER').then((r) => setOwners(r.items)).catch(() => {}); }, [load]);
  const save = async () => { try { if (edit) await api.patch(`/admin/channels/${edit.id}`, { name: form.name, description: form.description, isOfficial: form.isOfficial, ...(form.ownerId ? { ownerId: form.ownerId } : {}) }); else await api.post('/admin/channels', { ...form, ownerId: form.ownerId || undefined }); toast('Chaîne enregistrée.', 'success'); setOpen(false); setEdit(null); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const remove = async (id: string) => { if (!confirm('Supprimer cette chaîne (uniquement si vide) ?')) return; try { await api.delete(`/admin/channels/${id}`); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Chaînes</h1><button type="button" className="btn-primary" onClick={() => { setEdit(null); setForm({ name: '', description: '', isOfficial: true, ownerId: '' }); setOpen(true); }}>+ Nouvelle chaîne</button></div>
      <p className="text-sm text-simen-gray">Chaînes officielles du Ministère (MEN, IA, IEF, programmes) et chaînes d’enseignants. Les élèves et enseignants peuvent s’y abonner.</p>
      {!items ? <Spinner /> : (
        <ul className="grid gap-3 sm:grid-cols-2">{items.map((c) => <li key={c.id} className="card p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-bold">{c.isOfficial && <span className="text-simen-blue">✔ </span>}{c.name}</p><p className="text-xs text-simen-gray-mid">/chaines/{c.slug} · {c._count.media} médias · {c._count.subscribers} abonnés</p><p className="text-xs text-simen-gray-mid">Responsable : {c.owner.firstName} {c.owner.lastName}</p></div><Badge color={c.isOfficial ? 'blue' : 'orange'}>{c.isOfficial ? 'Officielle' : 'Enseignant'}</Badge></div>{c.description && <p className="mt-2 text-sm text-simen-gray">{c.description}</p>}<div className="mt-3 flex gap-2 text-xs"><Link href={`/chaines/${c.slug}`} className="btn-secondary px-2 py-1">Voir</Link><button type="button" className="btn-secondary px-2 py-1" onClick={() => { setEdit(c); setForm({ name: c.name, description: c.description ?? '', isOfficial: c.isOfficial, ownerId: '' }); setOpen(true); }}>Modifier</button><button type="button" className="btn-ghost px-2 py-1 text-sn-red" onClick={() => remove(c.id)}>Supprimer</button></div></li>)}</ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={edit ? 'Modifier la chaîne' : 'Nouvelle chaîne'}>
        <div className="space-y-3">
          <Field label="Nom" htmlFor="ch-name"><input id="ch-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
          <Field label="Description" htmlFor="ch-desc"><textarea id="ch-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={3} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isOfficial} onChange={(e) => setForm({ ...form, isOfficial: e.target.checked })} className="accent-simen-blue" />Chaîne officielle du Ministère</label>
          <Field label="Responsable (enseignant) — facultatif" htmlFor="ch-owner" hint="Par défaut : vous-même"><select id="ch-owner" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} className="input"><option value="">—</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>)}</select></Field>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button type="button" className="btn-primary" onClick={save}>Enregistrer</button></div>
        </div>
      </Modal>
    </div>
  );
}

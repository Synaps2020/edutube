'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';
import { formatDate, ROLE_LABELS } from '@/lib/utils';

interface C { id: string; content: string; status: string; hiddenReason: string | null; createdAt: string; author: { firstName: string; lastName: string; role: string }; media: { slug: string; title: string } }

export default function CommentairesPage() {
  const { toast } = useToast();
  const [statut, setStatut] = useState<'PENDING' | 'VISIBLE' | 'HIDDEN' | ''>('');
  const [items, setItems] = useState<C[] | null>(null);
  const load = useCallback(() => api.get<C[]>(`/admin/comments${statut ? `?statut=${statut}` : ''}`).then(setItems).catch((e) => toast(errorMessage(e), 'error')), [statut, toast]);
  useEffect(() => { load(); }, [load]);
  const setStatus = async (id: string, status: 'VISIBLE' | 'HIDDEN') => { const reason = status === 'HIDDEN' ? prompt('Motif (facultatif) :') ?? '' : undefined; try { await api.patch(`/admin/comments/${id}`, { status, reason }); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const remove = async (id: string) => { if (!confirm('Supprimer définitivement ce commentaire ?')) return; try { await api.delete(`/comments/${id}`); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Modération des commentaires</h1>
      <div role="tablist" className="flex gap-2">{([['', 'Tous'], ['PENDING', 'En attente'], ['VISIBLE', 'Visibles'], ['HIDDEN', 'Masqués']] as const).map(([s, l]) => <button key={s} role="tab" aria-selected={statut === s} type="button" onClick={() => setStatut(s)} className={statut === s ? 'btn-primary' : 'btn-secondary'}>{l}</button>)}</div>
      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="Aucun commentaire." /> : (
        <ul className="card divide-y divide-simen-gray-lighter">{items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-xs"><StatusBadge status={c.status} /><span className="font-semibold">{c.author.firstName} {c.author.lastName}</span><span className="text-simen-gray-mid">({ROLE_LABELS[c.author.role]}) · {formatDate(c.createdAt, true)} · sur <Link href={`/media/${c.media.slug}#commentaires`} className="text-simen-blue underline">{c.media.title}</Link></span></div><p className="mt-1 whitespace-pre-line">{c.content}</p>{c.hiddenReason && <p className="text-xs text-sn-red">Motif : {c.hiddenReason}</p>}</div>
            <div className="flex gap-1 text-xs">{c.status !== 'VISIBLE' && <button type="button" className="btn-primary px-2 py-1" onClick={() => setStatus(c.id, 'VISIBLE')}>{c.status === 'PENDING' ? 'Approuver' : 'Rétablir'}</button>}{c.status !== 'HIDDEN' && <button type="button" className="btn-secondary px-2 py-1" onClick={() => setStatus(c.id, 'HIDDEN')}>Masquer</button>}<button type="button" className="btn-ghost px-2 py-1 text-sn-red" onClick={() => remove(c.id)}>Supprimer</button></div>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

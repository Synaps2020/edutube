'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface Sub { id: string; title: string; type: string; status: string; createdAt: string; reviewedAt: string | null; reviewNote: string | null; classLevel: { code: string }; discipline: { name: string }; media: { slug: string; status: string } | null; reviewer: { firstName: string; lastName: string } | null }

export default function PropositionsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Sub[] | null>(null);
  const load = () => api.get<Sub[]>('/me/submissions').then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const withdraw = async (id: string) => { if (!confirm('Retirer cette proposition ?')) return; try { await api.delete(`/submissions/${id}`); load(); toast('Proposition retirée.', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Mes propositions</h1><Link href="/soumettre" className="btn-accent">Nouvelle proposition</Link></div>
      <p className="text-sm text-simen-gray">Vos propositions sont examinées par la cellule pédagogique. Seuls les administrateurs publient ; vous recevez un retour motivé en cas de refus.</p>
      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="Aucune proposition envoyée." /> : (
        <ul className="space-y-3">{items.map((s) => (
          <li key={s.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={s.status} /><span className="badge bg-simen-gray-lighter text-simen-gray">{s.type === 'VIDEO' ? 'Vidéo' : 'Audio'}</span><span className="text-xs text-simen-gray-mid">{s.classLevel.code} · {s.discipline.name} · envoyée le {formatDate(s.createdAt)}</span></div>
            <p className="mt-1 font-bold">{s.title}</p>
            {s.reviewNote && <p className={`mt-2 rounded-md px-3 py-2 text-sm ${s.status === 'REJECTED' ? 'bg-sn-red-light text-sn-red' : 'bg-sn-green-light text-sn-green'}`}><span className="font-semibold">Retour de {s.reviewer ? `${s.reviewer.firstName} ${s.reviewer.lastName}` : 'la modération'} :</span> {s.reviewNote}</p>}
            <div className="mt-2 flex gap-3 text-sm">
              {s.media && s.media.status === 'PUBLISHED' && <Link href={`/media/${s.media.slug}`} className="font-semibold text-simen-blue hover:underline">Voir le contenu publié →</Link>}
              {s.media && s.media.status !== 'PUBLISHED' && <span className="text-simen-gray-mid">Contenu en cours de traitement…</span>}
              {s.status === 'PENDING' && <button type="button" className="text-sn-red hover:underline" onClick={() => withdraw(s.id)}>Retirer</button>}
            </div>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

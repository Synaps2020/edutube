'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { EmptyState, Field, Modal, Spinner, StatusBadge } from '@/components/ui';
import { formatDate, ROLE_LABELS } from '@/lib/utils';

interface Rep { id: string; targetType: 'MEDIA' | 'COMMENT'; targetId: string; reason: string; details: string | null; status: string; resolution: string | null; createdAt: string; reporter: { firstName: string; lastName: string; role: string }; resolvedBy: { firstName: string; lastName: string } | null; target: { id: string; title?: string; slug?: string; status: string; content?: string; author?: { firstName: string; lastName: string }; media?: { slug: string; title: string } } | null }
const REASONS: Record<string, string> = { CONTENU_INAPPROPRIE: 'Contenu inapproprié', ERREUR_PEDAGOGIQUE: 'Erreur pédagogique', DROITS_AUTEUR: 'Droits d’auteur', HARCELEMENT: 'Harcèlement', SPAM: 'Spam', AUTRE: 'Autre' };

export default function SignalementsPage() {
  const { toast } = useToast();
  const [statut, setStatut] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED' | ''>('OPEN');
  const [items, setItems] = useState<Rep[] | null>(null);
  const [sel, setSel] = useState<Rep | null>(null);
  const [form, setForm] = useState({ status: 'RESOLVED', action: 'NONE', resolution: '' });
  const load = useCallback(() => api.get<Rep[]>(`/admin/reports${statut ? `?statut=${statut}` : ''}`).then(setItems).catch((e) => toast(errorMessage(e), 'error')), [statut, toast]);
  useEffect(() => { load(); }, [load]);
  const resolve = async () => { if (!sel) return; try { await api.patch(`/admin/reports/${sel.id}`, form); toast('Signalement traité.', 'success'); setSel(null); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Signalements</h1>
      <div role="tablist" className="flex gap-2">{([['OPEN', 'Ouverts'], ['RESOLVED', 'Traités'], ['DISMISSED', 'Classés'], ['', 'Tous']] as const).map(([s, l]) => <button key={s} role="tab" aria-selected={statut === s} type="button" onClick={() => setStatut(s)} className={statut === s ? 'btn-primary' : 'btn-secondary'}>{l}</button>)}</div>
      {!items ? <Spinner /> : items.length === 0 ? <EmptyState title="Aucun signalement." /> : (
        <ul className="space-y-3">{items.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs"><StatusBadge status={r.status} /><span className="badge bg-sn-red-light text-sn-red">{REASONS[r.reason] ?? r.reason}</span><span className="badge bg-simen-gray-lighter text-simen-gray">{r.targetType === 'MEDIA' ? 'Média' : 'Commentaire'}</span><span className="text-simen-gray-mid">{formatDate(r.createdAt, true)} · par {ROLE_LABELS[r.reporter.role]} {r.reporter.firstName} {r.reporter.lastName}</span></div>
                {r.target ? (r.targetType === 'MEDIA'
                  ? <p className="mt-1"><Link href={`/admin/contenus/${r.target.id}`} className="font-semibold text-simen-blue hover:underline">{r.target.title}</Link> <StatusBadge status={r.target.status} /></p>
                  : <p className="mt-1 rounded bg-simen-gray-lighter px-3 py-2">« {r.target.content} » — {r.target.author?.firstName} {r.target.author?.lastName} <StatusBadge status={r.target.status} /> sur <Link href={`/media/${r.target.media?.slug}#commentaires`} className="text-simen-blue underline">{r.target.media?.title}</Link></p>
                ) : <p className="mt-1 italic text-simen-gray-mid">Cible supprimée.</p>}
                {r.details && <p className="mt-1 text-simen-gray">Précisions : {r.details}</p>}
                {r.resolution && <p className="mt-1 text-xs text-sn-green">Décision ({r.resolvedBy?.firstName} {r.resolvedBy?.lastName}) : {r.resolution}</p>}
              </div>
              {r.status === 'OPEN' && <button type="button" className="btn-primary" onClick={() => { setSel(r); setForm({ status: 'RESOLVED', action: 'NONE', resolution: '' }); }}>Traiter</button>}
            </div>
          </li>
        ))}</ul>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Traiter le signalement">
        <div className="space-y-4">
          <Field label="Décision" htmlFor="st"><select id="st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input"><option value="RESOLVED">Fondé — traité</option><option value="DISMISSED">Non fondé — classé sans suite</option></select></Field>
          {form.status === 'RESOLVED' && <Field label="Action sur la cible" htmlFor="ac"><select id="ac" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="input"><option value="NONE">Aucune action automatique</option><option value="HIDE_TARGET">{sel?.targetType === 'COMMENT' ? 'Masquer le commentaire' : 'Archiver le média (retirer de la diffusion)'}</option></select></Field>}
          <Field label="Note de résolution" htmlFor="res"><textarea id="res" value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} className="input" rows={3} /></Field>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setSel(null)}>Annuler</button><button type="button" className="btn-primary" onClick={resolve}>Valider</button></div>
        </div>
      </Modal>
    </div>
  );
}

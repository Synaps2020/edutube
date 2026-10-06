'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { EmptyState, Field, Modal, Spinner, StatusBadge } from '@/components/ui';
import { formatDate, formatBytes, LANGUAGE_LABELS, ROLE_LABELS } from '@/lib/utils';

interface Sub { id: string; type: string; title: string; description: string; chapter: string | null; keywords: string[]; language: string; sourceUrl: string | null; attachmentName: string | null; attachmentSize: number | null; status: string; reviewNote: string | null; createdAt: string; reviewedAt: string | null; author: { id: string; firstName: string; lastName: string; role: string; establishment: string | null; region: string | null }; classLevel: { code: string; name: string }; discipline: { name: string }; theme: { name: string }; reviewer: { firstName: string; lastName: string } | null; media: { id: string; slug: string; status: string } | null }

// File de validation des propositions : approbation (avec note) ou rejet motivé ; historique.
export default function ModerationPage() {
  const { toast } = useToast();
  const [statut, setStatut] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [data, setData] = useState<{ items: Sub[]; meta: { total: number } } | null>(null);
  const [sel, setSel] = useState<Sub | null>(null);
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get<NonNullable<typeof data>>(`/admin/submissions?statut=${statut}`).then(setData).catch((e) => toast(errorMessage(e), 'error')), [statut, toast]);
  useEffect(() => { load(); }, [load]);
  const decide = async () => {
    if (!sel) return; setBusy(true);
    try {
      if (mode === 'approve') await api.post(`/admin/submissions/${sel.id}/approve`, { note });
      else await api.post(`/admin/submissions/${sel.id}/reject`, { reason: note });
      toast(mode === 'approve' ? 'Proposition approuvée.' : 'Proposition rejetée ; le contributeur est informé.', 'success');
      setSel(null); setNote(''); load();
    } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Propositions des enseignants et élèves</h1>
      <p className="text-sm text-simen-gray">Seuls les administrateurs publient. Approuver une proposition avec fichier joint crée le média (contributeur crédité), lance le transcodage puis la publication automatique. Sans fichier, la cellule téléverse elle-même le contenu via « Téléverser ». Tout rejet doit être motivé.</p>
      <div role="tablist" className="flex gap-2">{(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => <button key={s} role="tab" aria-selected={statut === s} type="button" onClick={() => setStatut(s)} className={statut === s ? 'btn-primary' : 'btn-secondary'}>{s === 'PENDING' ? 'En attente' : s === 'APPROVED' ? 'Approuvées' : 'Rejetées'}</button>)}</div>
      {!data ? <Spinner /> : data.items.length === 0 ? <EmptyState title={statut === 'PENDING' ? 'Aucune proposition en attente. Bravo !' : 'Aucune proposition.'} /> : (
        <ul className="space-y-3">{data.items.map((s) => (
          <li key={s.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs"><StatusBadge status={s.status} /><span className="badge bg-simen-gray-lighter text-simen-gray">{s.type === 'VIDEO' ? 'Vidéo' : 'Audio'}</span><span className="text-simen-gray-mid">{formatDate(s.createdAt, true)}</span></div>
                <h2 className="mt-1 text-lg font-bold">{s.title}</h2>
                <p className="text-sm text-simen-gray-mid">{ROLE_LABELS[s.author.role]} {s.author.firstName} {s.author.lastName}{s.author.establishment ? ` · ${s.author.establishment}` : ''}{s.author.region ? ` · ${s.author.region}` : ''}</p>
                <p className="mt-2 whitespace-pre-line text-sm">{s.description}</p>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div><dt className="inline font-semibold">Classe : </dt><dd className="inline">{s.classLevel.name}</dd></div><div><dt className="inline font-semibold">Discipline : </dt><dd className="inline">{s.discipline.name}</dd></div>
                  <div><dt className="inline font-semibold">Thématique : </dt><dd className="inline">{s.theme.name}</dd></div><div><dt className="inline font-semibold">Langue : </dt><dd className="inline">{LANGUAGE_LABELS[s.language]}</dd></div>
                  {s.chapter && <div><dt className="inline font-semibold">Chapitre : </dt><dd className="inline">{s.chapter}</dd></div>}{s.keywords.length > 0 && <div><dt className="inline font-semibold">Mots-clés : </dt><dd className="inline">{s.keywords.join(', ')}</dd></div>}
                  <div><dt className="inline font-semibold">Fichier : </dt><dd className="inline">{s.attachmentName ? `${s.attachmentName} (${formatBytes(s.attachmentSize)})` : 'aucun'}</dd></div>
                  {s.sourceUrl && <div><dt className="inline font-semibold">Lien : </dt><dd className="inline"><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-simen-blue underline">{s.sourceUrl}</a></dd></div>}
                </dl>
                {s.reviewNote && <p className="mt-2 rounded bg-simen-gray-lighter px-3 py-2 text-sm"><span className="font-semibold">Retour ({s.reviewer ? `${s.reviewer.firstName} ${s.reviewer.lastName}` : '—'}, {formatDate(s.reviewedAt)}) :</span> {s.reviewNote}</p>}
                {s.media && <p className="mt-2 text-sm">Média : <Link href={`/admin/contenus/${s.media.id}`} className="text-simen-blue underline">{s.media.slug}</Link> <StatusBadge status={s.media.status} /></p>}
              </div>
              {s.status === 'PENDING' && <div className="flex shrink-0 flex-col gap-2"><button type="button" className="btn-primary" onClick={() => { setSel(s); setMode('approve'); setNote(''); }}>Approuver</button><button type="button" className="btn-danger" onClick={() => { setSel(s); setMode('reject'); setNote(''); }}>Rejeter</button></div>}
            </div>
          </li>
        ))}</ul>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title={mode === 'approve' ? `Approuver « ${sel?.title} »` : `Rejeter « ${sel?.title} »`}>
        {mode === 'approve' && sel && !sel.attachmentName && <p className="mb-3 rounded bg-simen-orange-light px-3 py-2 text-sm text-simen-orange-dark">Aucun fichier joint : après approbation, téléversez le média depuis « Téléverser » en créditant l’auteur dans « Auteur pédagogique ».</p>}
        <Field label={mode === 'approve' ? 'Note au contributeur (facultatif)' : 'Motif du rejet (obligatoire, transmis au contributeur)'} htmlFor="note" required={mode === 'reject'}><textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} className="input" rows={4} placeholder={mode === 'reject' ? 'ex. Qualité sonore insuffisante ; merci de réenregistrer dans un lieu calme et de joindre la fiche pédagogique.' : 'ex. Excellent travail, publié sur la chaîne officielle.'} /></Field>
        <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setSel(null)}>Annuler</button><button type="button" className={mode === 'approve' ? 'btn-primary' : 'btn-danger'} disabled={busy || (mode === 'reject' && note.trim().length < 5)} onClick={decide}>{mode === 'approve' ? 'Confirmer l’approbation' : 'Confirmer le rejet'}</button></div>
      </Modal>
    </div>
  );
}

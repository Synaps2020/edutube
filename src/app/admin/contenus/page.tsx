'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { TaxonomySelects, useTaxonomy } from '@/components/forms/TaxonomySelects';
import { Field, Alert, Spinner, StatusBadge, Modal } from '@/components/ui';
import type { MediaDetailDTO } from '@/lib/media';
import { LANGUAGE_LABELS, DIFFICULTY_LABELS, LICENSES, formatBytes, formatDate, formatDuration } from '@/lib/utils';

interface Detail { media: MediaDetailDTO & { originalName: string | null; originalSize: number | null }; jobs: Array<{ id: string; type: string; status: string; progress: number; error: string | null; attempts: number; createdAt: string; finishedAt: string | null }>; decisions: Array<{ id: string; action: string; reason: string | null; createdAt: string; moderator: { firstName: string; lastName: string } }>; submission: { id: string; author: { firstName: string; lastName: string; role: string } } | null }

export default function AdminContenuPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const tax = useTaxonomy();
  const [d, setD] = useState<Detail | null>(null);
  const [f, setF] = useState<Record<string, string | boolean>>({});
  const [channels, setChannels] = useState<Array<{ id: string; name: string; isOfficial: boolean }>>([]);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState('');
  const load = useCallback(() => api.get<Detail>(`/admin/media/${params.id}`).then((x) => { setD(x); const m = x.media; setF({ title: m.title, description: m.description, cycleId: m.cycle.id, classLevelId: m.classLevel.id, disciplineId: m.discipline.id, themeId: m.theme.id, chapter: m.chapter, keywords: m.keywords.join(', '), language: m.language, license: m.license, pedagogicalAuthor: m.pedagogicalAuthor, difficulty: m.difficulty, channelId: m.channel.id, downloadable: m.downloadable, transcript: m.transcript ?? '' }); }).catch((e) => toast(errorMessage(e), 'error')), [params.id, toast]);
  useEffect(() => { load(); api.get<typeof channels>('/admin/channels').then(setChannels).catch(() => {}); }, [load]);
  useEffect(() => { if (d?.media.status === 'PROCESSING') { const t = setInterval(load, 5000); return () => clearInterval(t); } }, [d, load]);
  const up = (p: Record<string, string | boolean>) => setF((x) => ({ ...x, ...p }));
  const act = async (action: string, body?: unknown) => { try { await api.post(`/admin/media/${params.id}/${action}`, body ?? {}); toast('Action effectuée.', 'success'); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const save = async (e: React.FormEvent) => { e.preventDefault(); try { await api.patch(`/admin/media/${params.id}`, f); toast('Métadonnées enregistrées.', 'success'); load(); } catch (err) { toast(errorMessage(err), 'error'); } };
  const remove = async () => { if (!confirm('Supprimer DÉFINITIVEMENT ce contenu et ses fichiers ?')) return; try { await api.delete(`/admin/media/${params.id}`); toast('Contenu supprimé.', 'success'); router.push('/admin/contenus'); } catch (e) { toast(errorMessage(e), 'error'); } };
  const uploadFile = async (field: 'thumbnail' | 'subtitles', file: File) => { const fd = new FormData(); fd.append(field, file); try { await api.upload(`/admin/media/${params.id}/${field}`, fd); toast('Fichier mis à jour.', 'success'); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  if (!d) return <Spinner />;
  const m = d.media;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Link href="/admin/contenus" className="text-sm text-simen-blue hover:underline">← Contenus</Link><h1 className="text-2xl font-bold">{m.title}</h1><p className="flex flex-wrap items-center gap-2 text-sm text-simen-gray-mid"><StatusBadge status={m.status} />{m.type === 'VIDEO' ? 'Vidéo' : 'Audio'} · {formatDuration(m.durationSec)} · code <span className="font-mono">{m.shortCode}</span> · {m.viewCount} vues{d.submission && <> · proposé par {d.submission.author.firstName} {d.submission.author.lastName}</>}</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/media/${m.slug}`} className="btn-secondary">Prévisualiser</Link>
          {['DRAFT', 'PENDING', 'ARCHIVED'].includes(m.status) && <button type="button" className="btn-primary" onClick={() => act('publish')}>Publier</button>}
          {m.status === 'PUBLISHED' && <button type="button" className="btn-secondary" onClick={() => { const r = prompt('Motif d’archivage (facultatif) :') ?? ''; act('archive', { reason: r }); }}>Archiver</button>}
          {['DRAFT', 'PENDING', 'PUBLISHED'].includes(m.status) && <button type="button" className="btn-danger" onClick={() => setReject(true)}>Rejeter</button>}
          {['REJECTED', 'FAILED', 'ARCHIVED'].includes(m.status) && <button type="button" className="btn-secondary" onClick={() => act('restore')}>Restaurer / retraiter</button>}
          <button type="button" className="btn-ghost text-sn-red" onClick={remove}>Supprimer</button>
        </div>
      </div>
      {m.status === 'PROCESSING' && <Alert kind="info">Transcodage en cours{d.jobs[0] ? ` — ${d.jobs[0].progress} %` : ''}. Cette page se rafraîchit automatiquement.</Alert>}
      {m.processingError && <Alert kind="error">Erreur de traitement : {m.processingError}</Alert>}
      {m.rejectionReason && <Alert kind="warning">Motif de rejet : {m.rejectionReason}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={save} className="card space-y-4 p-6">
          <h2 className="font-bold">Métadonnées</h2>
          <Field label="Titre" htmlFor="title" required><input id="title" value={String(f.title ?? '')} onChange={(e) => up({ title: e.target.value })} className="input" required /></Field>
          <Field label="Description" htmlFor="description" required><textarea id="description" value={String(f.description ?? '')} onChange={(e) => up({ description: e.target.value })} className="input" rows={5} required /></Field>
          <TaxonomySelects taxonomy={tax} values={{ cycleId: String(f.cycleId ?? ''), classLevelId: String(f.classLevelId ?? ''), disciplineId: String(f.disciplineId ?? ''), themeId: String(f.themeId ?? '') }} onChange={(v) => up(v as Record<string, string>)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Chapitre" htmlFor="chapter" required><input id="chapter" value={String(f.chapter ?? '')} onChange={(e) => up({ chapter: e.target.value })} className="input" required /></Field>
            <Field label="Auteur pédagogique" htmlFor="author" required><input id="author" value={String(f.pedagogicalAuthor ?? '')} onChange={(e) => up({ pedagogicalAuthor: e.target.value })} className="input" required /></Field>
            <Field label="Mots-clés" htmlFor="keywords"><input id="keywords" value={String(f.keywords ?? '')} onChange={(e) => up({ keywords: e.target.value })} className="input" /></Field>
            <Field label="Langue" htmlFor="language"><select id="language" value={String(f.language)} onChange={(e) => up({ language: e.target.value })} className="input">{Object.entries(LANGUAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Niveau" htmlFor="difficulty"><select id="difficulty" value={String(f.difficulty)} onChange={(e) => up({ difficulty: e.target.value })} className="input">{Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Licence" htmlFor="license"><select id="license" value={String(f.license)} onChange={(e) => up({ license: e.target.value })} className="input">{LICENSES.map((l) => <option key={l}>{l}</option>)}{!LICENSES.includes(String(f.license)) && <option>{String(f.license)}</option>}</select></Field>
            <Field label="Chaîne" htmlFor="channel"><select id="channel" value={String(f.channelId)} onChange={(e) => up({ channelId: e.target.value })} className="input">{channels.map((c) => <option key={c.id} value={c.id}>{c.isOfficial ? '✔ ' : ''}{c.name}</option>)}</select></Field>
          </div>
          <Field label="Transcription" htmlFor="transcript"><textarea id="transcript" value={String(f.transcript ?? '')} onChange={(e) => up({ transcript: e.target.value })} className="input" rows={5} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.downloadable} onChange={(e) => up({ downloadable: e.target.checked })} className="accent-simen-blue" />Autoriser le téléchargement</label>
          <button type="submit" className="btn-primary">Enregistrer</button>
        </form>
        <aside className="space-y-4">
          <div className="card p-4"><h3 className="mb-2 font-bold">Miniature</h3>{m.thumbnailUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.thumbnailUrl} alt="" className="mb-2 aspect-video w-full rounded object-cover" /> : <p className="mb-2 text-xs text-simen-gray-mid">Générée après traitement.</p>}<label className="label text-xs" htmlFor="thumb-up">Remplacer</label><input id="thumb-up" type="file" accept="image/*" className="input text-xs" onChange={(e) => e.target.files?.[0] && uploadFile('thumbnail', e.target.files[0])} /></div>
          {m.type === 'VIDEO' && <div className="card p-4"><h3 className="mb-2 font-bold">Sous-titres (WebVTT)</h3><p className="mb-2 text-xs text-simen-gray-mid">{m.subtitlesUrl ? <a href={m.subtitlesUrl} className="text-simen-blue underline">Fichier actuel</a> : 'Aucun'}</p><input type="file" accept=".vtt" className="input text-xs" aria-label="Déposer des sous-titres" onChange={(e) => e.target.files?.[0] && uploadFile('subtitles', e.target.files[0])} /></div>}
          <div className="card p-4 text-xs"><h3 className="mb-2 font-bold">Fichiers</h3><p>Original : {m.originalName ?? '—'} {m.originalSize ? `(${formatBytes(m.originalSize)})` : ''}</p>{m.renditions && <p className="mt-1">Rendus HLS : {m.renditions.map((r) => `${r.height}p`).join(', ')}</p>}{m.width && <p>Source : {m.width}×{m.height}</p>}{m.audioUrl && <p>Audio normalisé : oui</p>}</div>
          <div className="card p-4 text-xs"><h3 className="mb-2 font-bold">Traitements</h3><ul className="space-y-1">{d.jobs.map((j) => <li key={j.id} className="flex items-center justify-between gap-2"><span>{j.type === 'TRANSCODE_VIDEO' ? 'Transcodage' : 'Audio'} · <StatusBadge status={j.status} /> {j.progress}%</span>{j.status === 'FAILED' && <button type="button" className="text-simen-blue underline" onClick={async () => { await api.post(`/admin/jobs/${j.id}/retry`); load(); }}>Relancer</button>}</li>)}{d.jobs.length === 0 && <li>Aucun</li>}</ul></div>
          <div className="card p-4 text-xs"><h3 className="mb-2 font-bold">Historique de modération</h3><ul className="space-y-1">{d.decisions.map((x) => <li key={x.id}><span className="font-semibold">{x.action}</span> — {x.moderator.firstName} {x.moderator.lastName}, {formatDate(x.createdAt, true)}{x.reason && <> : {x.reason}</>}</li>)}{d.decisions.length === 0 && <li>Aucune décision.</li>}</ul></div>
        </aside>
      </div>
      <Modal open={reject} onClose={() => setReject(false)} title="Rejeter ce contenu">
        <Field label="Motif (transmis au contributeur)" htmlFor="rej" required><textarea id="rej" value={reason} onChange={(e) => setReason(e.target.value)} className="input" rows={4} minLength={5} /></Field>
        <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setReject(false)}>Annuler</button><button type="button" className="btn-danger" disabled={reason.trim().length < 5} onClick={async () => { await act('reject', { reason }); setReject(false); }}>Rejeter</button></div>
      </Modal>
    </div>
  );
}

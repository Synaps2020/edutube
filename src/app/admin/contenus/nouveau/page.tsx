'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, uploadWithProgress, errorMessage, ApiClientError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { TaxonomySelects, useTaxonomy } from '@/components/forms/TaxonomySelects';
import { Field, Alert } from '@/components/ui';
import { LANGUAGE_LABELS, DIFFICULTY_LABELS, LICENSES, formatBytes } from '@/lib/utils';

// Formulaire riche de téléversement administrateur : métadonnées pédagogiques obligatoires,
// miniature et sous-titres optionnels, publication immédiate ou différée.
export default function NouveauContenuPage() {
  const router = useRouter();
  const tax = useTaxonomy();
  const { toast } = useToast();
  const [channels, setChannels] = useState<Array<{ id: string; name: string; isOfficial: boolean }>>([]);
  const [f, setF] = useState({ type: 'VIDEO', title: '', description: '', cycleId: '', classLevelId: '', disciplineId: '', themeId: '', chapter: '', keywords: '', language: 'FR', license: LICENSES[0], pedagogicalAuthor: '', difficulty: 'INTERMEDIAIRE', channelId: '', downloadable: false, publishImmediately: true, transcript: '' });
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [subs, setSubs] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const up = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  useEffect(() => { api.get<typeof channels>('/admin/channels').then((c) => { setChannels(c); const off = c.find((x) => x.isOfficial); if (off) setF((x) => ({ ...x, channelId: off.id })); }).catch(() => {}); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setErrors({});
    if (!file) { setError('Le fichier média est obligatoire.'); return; }
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append('file', file); if (thumb) fd.append('thumbnail', thumb); if (subs) fd.append('subtitles', subs);
    setProgress(0);
    try {
      const r = await uploadWithProgress<{ id: string }>('/admin/media', fd, setProgress);
      toast('Fichier reçu : transcodage en cours. Le contenu sera publié automatiquement une fois prêt.', 'success');
      router.push(`/admin/contenus/${r.id}`);
    } catch (err) { if (err instanceof ApiClientError && err.details) setErrors(err.details); setError(errorMessage(err)); setProgress(null); }
  };

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Téléverser un contenu</h1>
      <p className="text-sm text-simen-gray">Les métadonnées pédagogiques marquées * sont obligatoires. La vidéo sera transcodée en HLS adaptatif (240p → 1080p) ; l’audio sera normalisé (EBU R128) et sa forme d’onde générée. Une miniature est produite automatiquement si vous n’en fournissez pas.</p>
      {error && <Alert kind="error">{error}</Alert>}
      <section className="card space-y-4 p-6">
        <h2 className="font-bold">Fichiers</h2>
        <fieldset><legend className="label">Type *</legend><div className="flex gap-4 text-sm">{[['VIDEO', 'Vidéo'], ['AUDIO', 'Audio']].map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="radio" name="type" value={v} checked={f.type === v} onChange={() => up({ type: v })} className="accent-simen-blue" />{l}</label>)}</div></fieldset>
        <Field label={`Fichier ${f.type === 'VIDEO' ? 'vidéo (MP4, MOV, MKV, WebM, AVI)' : 'audio (MP3, M4A, WAV, FLAC, OGG)'}`} htmlFor="file" required hint="Taille maximale définie par MAX_UPLOAD_MB (2 Go par défaut)">
          <input id="file" type="file" required accept={f.type === 'VIDEO' ? 'video/*' : 'audio/*'} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input" />{file && <p className="mt-1 text-xs text-simen-gray-mid">{file.name} — {formatBytes(file.size)}</p>}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Miniature (JPEG/PNG/WebP, 16:9 conseillé)" htmlFor="thumb" hint="Générée automatiquement sinon"><input id="thumb" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setThumb(e.target.files?.[0] ?? null)} className="input" /></Field>
          {f.type === 'VIDEO' && <Field label="Sous-titres WebVTT (.vtt)" htmlFor="subs" hint="Recommandé pour l’accessibilité"><input id="subs" type="file" accept=".vtt,text/vtt" onChange={(e) => setSubs(e.target.files?.[0] ?? null)} className="input" /></Field>}
        </div>
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="font-bold">Métadonnées pédagogiques</h2>
        <Field label="Titre" htmlFor="title" required error={errors.title?.[0]}><input id="title" value={f.title} onChange={(e) => up({ title: e.target.value })} className="input" required minLength={3} maxLength={160} /></Field>
        <Field label="Description" htmlFor="description" required error={errors.description?.[0]}><textarea id="description" value={f.description} onChange={(e) => up({ description: e.target.value })} className="input" rows={5} required minLength={10} /></Field>
        <TaxonomySelects taxonomy={tax} values={f} onChange={up} errors={errors} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chapitre / séquence" htmlFor="chapter" required error={errors.chapter?.[0]}><input id="chapter" value={f.chapter} onChange={(e) => up({ chapter: e.target.value })} className="input" required maxLength={160} /></Field>
          <Field label="Auteur pédagogique" htmlFor="author" required hint="Enseignant, inspecteur, cellule…" error={errors.pedagogicalAuthor?.[0]}><input id="author" value={f.pedagogicalAuthor} onChange={(e) => up({ pedagogicalAuthor: e.target.value })} className="input" required maxLength={160} /></Field>
          <Field label="Mots-clés" htmlFor="keywords" required hint="Séparés par des virgules" error={errors.keywords?.[0]}><input id="keywords" value={f.keywords} onChange={(e) => up({ keywords: e.target.value })} className="input" required /></Field>
          <Field label="Langue" htmlFor="language" required><select id="language" value={f.language} onChange={(e) => up({ language: e.target.value })} className="input">{Object.entries(LANGUAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Niveau de difficulté" htmlFor="difficulty" required><select id="difficulty" value={f.difficulty} onChange={(e) => up({ difficulty: e.target.value })} className="input">{Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Licence" htmlFor="license" required><select id="license" value={f.license} onChange={(e) => up({ license: e.target.value })} className="input">{LICENSES.map((l) => <option key={l}>{l}</option>)}</select></Field>
          <Field label="Chaîne de publication" htmlFor="channel" required error={errors.channelId?.[0]}><select id="channel" value={f.channelId} onChange={(e) => up({ channelId: e.target.value })} className="input" required><option value="">Choisir…</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.isOfficial ? '✔ ' : ''}{c.name}</option>)}</select></Field>
        </div>
        <Field label="Transcription (texte intégral, facultatif)" htmlFor="transcript" hint="Améliore l’accessibilité et la recherche plein texte"><textarea id="transcript" value={f.transcript} onChange={(e) => up({ transcript: e.target.value })} className="input" rows={4} /></Field>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.downloadable} onChange={(e) => up({ downloadable: e.target.checked })} className="accent-simen-blue" />Autoriser le téléchargement</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.publishImmediately} onChange={(e) => up({ publishImmediately: e.target.checked })} className="accent-simen-blue" />Publier automatiquement après traitement (sinon : brouillon)</label>
        </div>
      </section>
      {progress !== null && <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-3 overflow-hidden rounded-full bg-simen-gray-lighter"><div className="h-full bg-simen-blue transition-all" style={{ width: `${progress}%` }} /></div>}
      <div className="flex justify-end gap-3"><Link href="/admin/contenus" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary" disabled={progress !== null}>{progress !== null ? `Envoi… ${progress} %` : 'Téléverser et traiter'}</button></div>
    </form>
  );
}

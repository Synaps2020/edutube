'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { uploadWithProgress, errorMessage, ApiClientError } from '@/lib/client/api';
import { useSession } from '@/lib/client/session-context';
import { useToast } from '@/lib/client/toast-context';
import { TaxonomySelects, useTaxonomy } from '@/components/forms/TaxonomySelects';
import { Field, Alert } from '@/components/ui';
import { LANGUAGE_LABELS, formatBytes } from '@/lib/utils';

// Formulaire simplifié de proposition (enseignant / élève). Le contenu n'est visible qu'après validation.
export default function SoumettrePage() {
  const { user } = useSession();
  const router = useRouter();
  const tax = useTaxonomy();
  const { toast } = useToast();
  const [f, setF] = useState({ type: 'VIDEO', title: '', description: '', cycleId: '', classLevelId: '', disciplineId: '', themeId: '', chapter: '', keywords: '', language: 'FR', sourceUrl: '' });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const up = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  if (user?.role === 'ADMIN') return <Alert kind="info">En tant qu’administrateur, publiez directement depuis <Link href="/admin/contenus/nouveau" className="font-semibold underline">l’espace d’administration</Link>.</Alert>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setErrors({});
    if (!file && !f.sourceUrl) { setError('Joignez un fichier ou indiquez un lien vers votre contenu.'); return; }
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('file', file);
    setProgress(0);
    try {
      await uploadWithProgress('/submissions', fd, setProgress);
      toast('Proposition envoyée ! Elle sera examinée par la cellule pédagogique.', 'success');
      router.push('/mon-espace/propositions');
    } catch (err) { if (err instanceof ApiClientError && err.details) setErrors(err.details); setError(errorMessage(err)); setProgress(null); }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Proposer un contenu</h1>
        <p className="mt-1 text-sm text-simen-gray">Merci de contribuer ! Votre proposition sera examinée par la cellule pédagogique numérique du Ministère. Elle sera visible par les autres utilisateurs uniquement après validation ; en cas de refus, vous recevrez un retour motivé. Consultez la <Link href="/charte" className="font-semibold text-simen-blue hover:underline">charte</Link> avant de soumettre.</p>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="card space-y-4 p-6">
        <fieldset><legend className="label">Type de contenu</legend><div className="flex gap-4 text-sm">{[['VIDEO', 'Vidéo'], ['AUDIO', 'Audio']].map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="radio" name="type" value={v} checked={f.type === v} onChange={() => up({ type: v })} className="accent-simen-blue" />{l}</label>)}</div></fieldset>
        <Field label="Titre" htmlFor="title" required error={errors.title?.[0]} hint="ex. Résolution d’équations du premier degré (4e)"><input id="title" value={f.title} onChange={(e) => up({ title: e.target.value })} className="input" required minLength={3} maxLength={160} /></Field>
        <Field label="Description" htmlFor="description" required error={errors.description?.[0]} hint="Objectifs pédagogiques, déroulé, public visé…"><textarea id="description" value={f.description} onChange={(e) => up({ description: e.target.value })} className="input" rows={5} required minLength={10} maxLength={3000} /></Field>
        <TaxonomySelects taxonomy={tax} values={f} onChange={up} errors={errors} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chapitre / séquence" htmlFor="chapter"><input id="chapter" value={f.chapter} onChange={(e) => up({ chapter: e.target.value })} className="input" maxLength={160} /></Field>
          <Field label="Langue principale" htmlFor="language"><select id="language" value={f.language} onChange={(e) => up({ language: e.target.value })} className="input">{Object.entries(LANGUAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Mots-clés" htmlFor="keywords" hint="Séparés par des virgules"><input id="keywords" value={f.keywords} onChange={(e) => up({ keywords: e.target.value })} className="input" placeholder="équation, algèbre, BFEM" /></Field>
        </div>
      </div>
      <div className="card space-y-4 p-6">
        <h2 className="font-bold">Votre fichier</h2>
        <Field label={`Fichier ${f.type === 'VIDEO' ? 'vidéo (MP4, MOV, MKV, WebM)' : 'audio (MP3, M4A, WAV, OGG)'}`} htmlFor="file" hint="Taille maximale : 500 Mo. Le fichier n’est pas diffusé tant que la proposition n’est pas validée.">
          <input id="file" type="file" accept={f.type === 'VIDEO' ? 'video/*' : 'audio/*'} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input" />
          {file && <p className="mt-1 text-xs text-simen-gray-mid">{file.name} — {formatBytes(file.size)}</p>}
        </Field>
        <p className="text-center text-xs font-semibold text-simen-gray-mid">— ou —</p>
        <Field label="Lien vers le contenu" htmlFor="sourceUrl" hint="Si le fichier est trop volumineux : lien de partage (espace de stockage de l’école, etc.)" error={errors.sourceUrl?.[0]}><input id="sourceUrl" type="url" value={f.sourceUrl} onChange={(e) => up({ sourceUrl: e.target.value })} className="input" placeholder="https://…" /></Field>
      </div>
      {progress !== null && <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-3 overflow-hidden rounded-full bg-simen-gray-lighter"><div className="h-full bg-simen-blue transition-all" style={{ width: `${progress}%` }} /></div>}
      <div className="flex justify-end gap-3"><Link href="/mon-espace" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary" disabled={progress !== null}>{progress !== null ? `Envoi… ${progress} %` : 'Envoyer la proposition'}</button></div>
    </form>
  );
}

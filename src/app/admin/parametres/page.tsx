'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { Field, Spinner, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface Job { id: string; type: string; status: string; progress: number; attempts: number; error: string | null; createdAt: string; media: { id: string; title: string; type: string; status: string } }
const LABELS: Record<string, { label: string; hint: string }> = {
  'quota.submission.maxPerWeek': { label: 'Propositions par semaine et par utilisateur', hint: 'Quota anti-abus' },
  'quota.submission.maxMb': { label: 'Taille max. d’une pièce jointe de proposition (Mo)', hint: '' },
  'quota.comment.maxPerHour': { label: 'Commentaires par heure et par utilisateur', hint: '' },
  'moderation.commentsRequireApproval': { label: 'Commentaires soumis à validation préalable (true/false)', hint: 'Si true, les commentaires d’élèves/enseignants sont masqués jusqu’à approbation' },
  'platform.announcement': { label: 'Annonce affichée en page d’accueil', hint: 'Laisser vide pour masquer' },
};

export default function ParametresPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const load = useCallback(() => { api.get<Record<string, string>>('/admin/settings').then(setSettings).catch(() => {}); api.get<Job[]>('/admin/jobs').then(setJobs).catch(() => {}); }, []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  const save = async (e: React.FormEvent) => { e.preventDefault(); try { await api.patch('/admin/settings', settings); toast('Paramètres enregistrés.', 'success'); } catch (err) { toast(errorMessage(err), 'error'); } };
  const retry = async (id: string) => { try { await api.post(`/admin/jobs/${id}/retry`); load(); } catch (err) { toast(errorMessage(err), 'error'); } };
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Paramètres, quotas et exports</h1>
      {!settings ? <Spinner /> : (
        <form onSubmit={save} className="card space-y-4 p-6"><h2 className="font-bold">Quotas et limites</h2>
          {Object.entries(settings).map(([k, v]) => <Field key={k} label={LABELS[k]?.label ?? k} htmlFor={`s-${k}`} hint={LABELS[k]?.hint}><input id={`s-${k}`} value={v} onChange={(e) => setSettings({ ...settings, [k]: e.target.value })} className="input" /></Field>)}
          <button type="submit" className="btn-primary">Enregistrer</button>
        </form>
      )}
      <section className="card p-6"><h2 className="mb-2 font-bold">Exports CSV</h2><p className="mb-3 text-sm text-simen-gray">Séparateur « ; », encodage UTF-8 (ouverture directe dans Excel / LibreOffice).</p><div className="flex flex-wrap gap-2">{[['media', 'Contenus'], ['users', 'Utilisateurs'], ['views', 'Vues par jour et par contenu'], ['submissions', 'Propositions'], ['audit', 'Journal d’audit']].map(([t, l]) => <a key={t} href={`/api/v1/admin/export?type=${t}`} className="btn-secondary">{l}</a>)}</div></section>
      <section id="jobs" className="card p-6"><h2 className="mb-3 font-bold">File de traitement (transcodage / audio)</h2>
        {!jobs ? <Spinner /> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left uppercase text-simen-gray"><th className="p-2">Date</th><th className="p-2">Média</th><th className="p-2">Type</th><th className="p-2">Statut</th><th className="p-2">Progression</th><th className="p-2">Tentatives</th><th className="p-2">Erreur</th><th></th></tr></thead><tbody>{jobs.map((j) => <tr key={j.id} className="border-b border-simen-gray-lighter"><td className="whitespace-nowrap p-2">{formatDate(j.createdAt, true)}</td><td className="p-2">{j.media.title}</td><td className="p-2">{j.type === 'TRANSCODE_VIDEO' ? 'Vidéo → HLS' : 'Audio'}</td><td className="p-2"><StatusBadge status={j.status} /></td><td className="p-2"><div className="h-1.5 w-24 rounded bg-simen-gray-lighter"><div className="h-1.5 rounded bg-simen-blue" style={{ width: `${j.progress}%` }} /></div></td><td className="p-2">{j.attempts}</td><td className="max-w-xs truncate p-2 text-sn-red" title={j.error ?? ''}>{j.error}</td><td className="p-2">{j.status === 'FAILED' && <button type="button" className="btn-secondary px-2 py-1" onClick={() => retry(j.id)}>Relancer</button>}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="card p-6 text-sm"><h2 className="mb-2 font-bold">Supervision</h2><ul className="list-inside list-disc space-y-1 text-simen-gray"><li>Sonde de santé : <a className="text-simen-blue underline" href="/api/v1/health">/api/v1/health</a></li><li>Métriques Prometheus : <code>/api/v1/metrics</code> (jeton METRICS_TOKEN)</li><li>Tableaux Grafana : voir <code>docs/DEPLOIEMENT.md</code> (profil <code>monitoring</code> de docker-compose)</li></ul></section>
    </div>
  );
}

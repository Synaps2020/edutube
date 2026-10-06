'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { Spinner } from '@/components/ui';

interface Stats {
  users: Record<string, number>;
  media: Record<string, number>;
  mediaByType: Record<string, number>;
  views30: number;
  viewsTotal: number;
  newUsers30: number;
  pendingSubmissions: number;
  openReports: number;
  storageBytes: number;
  topMedia: Array<{ id?: string; slug: string; title: string; type: string; viewCount: number; likeCount: number; commentCount: number }>;
  viewsPerDay: Array<{ day: string; count: number }>;
  byDiscipline: Array<{ name: string; color: string; count: number }>;
  byCycle: Array<{ name: string; count: number }>;
  byRegion: Array<{ region: string; count: number }>;
  senprofMediaCount: number;
  demoMediaCount: number;
}

const number = new Intl.NumberFormat('fr-FR');
const compact = (value: number) => number.format(value);
const size = (bytes: number) => `${(bytes / 1024 / 1024 / 1024).toFixed(1).replace('.', ',')} Go`;

function BarList({ items, color = '#0099cc' }: { items: Array<{ label: string; value: number; color?: string }>; color?: string }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="space-y-2">{items.map((item) => <div key={item.label} className="text-xs"><div className="mb-1 flex items-center justify-between gap-3"><span className="truncate text-simen-gray-dark">{item.label}</span><span className="font-semibold text-simen-gray-mid">{compact(item.value)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-simen-gray-lighter"><div className="h-full rounded-full" style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, backgroundColor: item.color ?? color }} /></div></div>)}</div>;
}

function ViewsChart({ values }: { values: Array<{ day: string; count: number }> }) {
  const data = values.length ? values : Array.from({ length: 30 }, (_, index) => ({ day: String(index), count: 0 }));
  const max = Math.max(...data.map((item) => item.count), 1);
  return <div className="flex h-36 items-end gap-1 border-b border-simen-gray-light px-2 pb-2">{data.slice(-30).map((item, index) => <div key={`${item.day}-${index}`} className="group relative flex h-full flex-1 items-end" title={`${compact(item.count)} vues`}><div className="w-full rounded-t-sm bg-simen-blue transition hover:bg-simen-blue-dark" style={{ height: `${Math.max((item.count / max) * 100, item.count ? 5 : 1)}%` }} /></div>)}</div>;
}

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get<Stats>('/admin/stats').then(setStats).catch((error) => toast(errorMessage(error), 'error'));
  useEffect(() => { load(); }, [toast]);
  const importSenprof = async () => {
    setBusy(true);
    try {
      const result = await api.post<{ created: Array<unknown>; skipped: Array<unknown> }>('/admin/import/senprof', { publishImmediately: true });
      toast(`${result.created.length} vidéo(s) SenProf importée(s), ${result.skipped.length} déjà présente(s).`, 'success');
      await load();
    } catch (error) { toast(errorMessage(error), 'error'); } finally { setBusy(false); }
  };
  const removeDemo = async () => {
    if (!confirm('Supprimer uniquement les médias de démonstration générés par le seed ?')) return;
    setBusy(true);
    try {
      const result = await api.delete<{ deleted: number }>('/admin/media/demo');
      toast(`${result.deleted} média(s) de démonstration supprimé(s).`, 'success');
      await load();
    } catch (error) { toast(errorMessage(error), 'error'); } finally { setBusy(false); }
  };
  const users = stats?.users ?? {};
  const published = stats?.media.PUBLISHED ?? 0;
  const disciplineItems = useMemo(() => (stats?.byDiscipline ?? []).map((item) => ({ label: item.name, value: item.count, color: item.color })), [stats]);
  const cycleItems = useMemo(() => (stats?.byCycle ?? []).map((item) => ({ label: item.name, value: item.count })), [stats]);
  const regionItems = useMemo(() => (stats?.byRegion ?? []).map((item) => ({ label: item.region, value: item.count, color: '#666666' })), [stats]);
  if (!stats) return <div className="flex min-h-96 items-center justify-center"><Spinner /></div>;
  return <div className="admin-dashboard space-y-4">
    <h1 className="text-2xl font-bold">Tableau de bord d’audience</h1>
    <section className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-simen-blue p-4" aria-labelledby="senprof-title">
      <div><h2 id="senprof-title" className="font-bold">Catalogue SenProf</h2><p className="text-xs text-simen-gray-mid">Importe les nouvelles vidéos, les titre et les classe automatiquement par niveau, discipline et thème.</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-simen-gray-mid">{compact(stats.senprofMediaCount)} vidéo(s) SenProf · {compact(stats.demoMediaCount)} simulation(s)</span><button type="button" className="btn-primary" onClick={importSenprof} disabled={busy}>Importer SenProf</button><button type="button" className="btn-secondary" onClick={removeDemo} disabled={busy}>Supprimer les simulations</button></div>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs principaux">
      <div className="admin-kpi card border-l-4 border-l-simen-blue p-3"><p className="text-[10px] font-bold uppercase text-simen-gray-mid">Vues (30 jours)</p><p className="mt-1 text-3xl font-bold">{compact(stats.views30)}</p><p className="text-[11px] text-simen-gray-mid">{compact(stats.viewsTotal)} au total</p></div>
      <div className="admin-kpi card border-l-4 border-l-sn-green p-3"><p className="text-[10px] font-bold uppercase text-simen-gray-mid">Contenus publiés</p><p className="mt-1 text-3xl font-bold">{compact(published)}</p><p className="text-[11px] text-simen-gray-mid">{compact(stats.mediaByType.VIDEO ?? 0)} vidéos · {compact(stats.mediaByType.AUDIO ?? 0)} audios</p></div>
      <div className="admin-kpi card border-l-4 border-l-simen-orange p-3"><p className="text-[10px] font-bold uppercase text-simen-gray-mid">Utilisateurs</p><p className="mt-1 text-3xl font-bold">{compact(Object.values(users).reduce((sum, value) => sum + value, 0))}</p><p className="text-[11px] text-simen-gray-mid">+{compact(stats.newUsers30)} sur 30 j · {compact(users.TEACHER ?? 0)} enseignants</p></div>
      <div className="admin-kpi card border-l-4 border-l-sn-red p-3"><p className="text-[10px] font-bold uppercase text-simen-gray-mid">À traiter</p><p className="mt-1 text-3xl font-bold">{compact(stats.pendingSubmissions + stats.openReports)}</p><p className="text-[11px] text-simen-gray-mid">{compact(stats.pendingSubmissions)} propositions · {compact(stats.openReports)} signalements</p></div>
    </section>
    <div className="flex flex-wrap gap-2"><Link href="/admin/moderation" className="btn-accent">Valider {stats.pendingSubmissions} proposition(s)</Link><Link href="/admin/signalements" className="btn-danger">Traiter {stats.openReports} signalement(s)</Link><span className="ml-auto self-center text-xs text-simen-gray-mid">Stockage des originaux : {size(stats.storageBytes)}</span></div>
    <section className="admin-chart card p-3" aria-labelledby="views-title"><div className="mb-3 flex items-center justify-between"><h2 id="views-title" className="text-sm font-bold">Vues par jour (30 derniers jours)</h2><span className="text-[11px] text-simen-gray-mid">{compact(stats.views30)} vues</span></div><ViewsChart values={stats.viewsPerDay} /></section>
    <div className="grid gap-3 lg:grid-cols-3"><section className="card p-3"><h2 className="mb-3 text-sm font-bold">Vues par discipline</h2><BarList items={disciplineItems} /></section><section className="card p-3"><h2 className="mb-3 text-sm font-bold">Vues par cycle</h2><BarList items={cycleItems} color="#ff9900" /></section><section className="card p-3"><h2 className="mb-3 text-sm font-bold">Utilisateurs par région</h2><BarList items={regionItems} /></section></div>
    <section className="card overflow-hidden"><div className="border-b border-simen-gray-lighter px-3 py-2.5"><h2 className="text-sm font-bold">Contenus les plus consultés</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="bg-simen-gray-lighter text-[10px] uppercase text-simen-gray-mid"><tr><th className="px-3 py-2">Titre</th><th className="px-2 py-2">Type</th><th className="px-2 py-2">Vues</th><th className="px-2 py-2">J’aime</th><th className="px-2 py-2">Comm.</th></tr></thead><tbody className="divide-y divide-simen-gray-lighter">{stats.topMedia.map((media) => <tr key={media.id ?? media.slug} className="hover:bg-simen-gray-lighter/60"><td className="max-w-[34rem] px-3 py-1.5"><Link href={`/media/${media.slug}`} className="font-semibold text-simen-blue hover:underline">{media.title}</Link></td><td className="px-2 py-1.5">{media.type === 'VIDEO' ? 'Vidéo' : 'Audio'}</td><td className="px-2 py-1.5">{compact(media.viewCount)}</td><td className="px-2 py-1.5">{compact(media.likeCount)}</td><td className="px-2 py-1.5">{compact(media.commentCount)}</td></tr>)}</tbody></table></div></section>
    <section className="card p-4"><h2 className="mb-3 font-bold">Contenus par statut</h2><div className="flex flex-wrap gap-2 text-xs">{Object.entries(stats.media).map(([status, count]) => <span key={status} className="rounded border border-simen-gray-light px-3 py-1.5 font-semibold">{count} {status}</span>)}</div><p className="mt-3 text-xs text-simen-gray-mid">{compact(published)} contenus publiés · {compact(stats.viewsTotal)} vues · {compact(stats.openReports)} signalements ouverts</p></section>
  </div>;
}

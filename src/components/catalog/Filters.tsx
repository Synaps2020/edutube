'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import type { Taxonomy } from '@/lib/media';
import { LANGUAGE_LABELS, DIFFICULTY_LABELS } from '@/lib/utils';

// Filtres du catalogue : l'état vit dans l'URL (partageable, navigable au clavier, sans JS côté serveur).
export function Filters({ taxonomy, total }: { taxonomy: Taxonomy; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k) ?? '';
  const set = useCallback((k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    p.delete('page');
    if (k === 'cycle') p.delete('classe');
    router.push(`${pathname}?${p.toString()}`);
  }, [sp, router, pathname]);

  const cycle = taxonomy.cycles.find((c) => c.code === get('cycle'));
  const classes = cycle ? cycle.classes : taxonomy.cycles.flatMap((c) => c.classes);
  const Sel = ({ k, label, children }: { k: string; label: string; children: React.ReactNode }) => (
    <div><label htmlFor={`f-${k}`} className="label text-xs">{label}</label><select id={`f-${k}`} value={get(k)} onChange={(e) => set(k, e.target.value)} className="input py-1.5 text-sm">{children}</select></div>
  );
  const active = ['type', 'cycle', 'classe', 'discipline', 'theme', 'langue', 'niveau', 'duree', 'depuis'].filter((k) => get(k)).length;

  return (
    <aside aria-label="Filtres du catalogue" className="card p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Filtres</h2>{active > 0 && <button type="button" className="text-xs text-simen-blue hover:underline" onClick={() => router.push(`${pathname}${get('q') ? `?q=${encodeURIComponent(get('q'))}` : ''}`)}>Réinitialiser ({active})</button>}</div>
      <p className="mb-3 text-xs text-simen-gray-mid" aria-live="polite">{total} contenu{total > 1 ? 's' : ''}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <Sel k="type" label="Type"><option value="">Vidéos et audios</option><option value="VIDEO">Vidéos</option><option value="AUDIO">Audios</option></Sel>
        <Sel k="cycle" label="Cycle"><option value="">Tous les cycles</option>{taxonomy.cycles.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Sel>
        <Sel k="classe" label="Classe"><option value="">Toutes les classes</option>{classes.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Sel>
        <Sel k="discipline" label="Discipline"><option value="">Toutes les disciplines</option>{taxonomy.disciplines.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}</Sel>
        <Sel k="theme" label="Thématique"><option value="">Toutes les thématiques</option>{taxonomy.themes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}</Sel>
        <Sel k="langue" label="Langue"><option value="">Toutes</option>{Object.entries(LANGUAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Sel>
        <Sel k="niveau" label="Niveau de difficulté"><option value="">Tous</option>{Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Sel>
        <Sel k="duree" label="Durée"><option value="">Toutes</option><option value="court">Moins de 5 min</option><option value="moyen">5 à 20 min</option><option value="long">Plus de 20 min</option></Sel>
        <Sel k="depuis" label="Date de publication"><option value="">Toutes</option><option value="7j">7 derniers jours</option><option value="30j">30 derniers jours</option><option value="365j">Cette année</option></Sel>
        <Sel k="tri" label="Trier par"><option value="">Plus récents</option><option value="populaire">Plus consultés</option><option value="aime">Plus aimés</option>{get('q') && <option value="pertinence">Pertinence</option>}</Sel>
      </div>
    </aside>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTaxonomy, listMedia } from '@/lib/media';
import { catalogQuerySchema } from '@/lib/validation';
import { Filters } from '@/components/catalog/Filters';
import { MediaGrid } from '@/components/media/MediaCard';
import { Pagination } from '@/components/ui';

export const metadata: Metadata = { title: 'Catalogue' };

export default async function CataloguePage({ searchParams }: PageProps<'/catalogue'>) {
  const resolvedSearchParams = await searchParams;
  const parsed = catalogQuerySchema.safeParse(resolvedSearchParams);
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});
  if (query.q && !resolvedSearchParams.tri) query.tri = 'pertinence';
  let taxonomy: Awaited<ReturnType<typeof getTaxonomy>>;
  let result: Awaited<ReturnType<typeof listMedia>>;
  try {
    [taxonomy, result] = await Promise.all([getTaxonomy(), listMedia(query)]);
  } catch {
    return (
      <section className="card mx-auto max-w-2xl p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-simen-orange-dark">Catalogue</p>
        <h1 className="mt-2 text-2xl font-black">Le catalogue est momentanément indisponible</h1>
        <p className="mt-3 text-sm leading-relaxed text-simen-gray">La base de données n’est pas encore accessible. Démarrez PostgreSQL, puis actualisez cette page pour afficher les ressources pédagogiques.</p>
      </section>
    );
  }
  const pageQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(resolvedSearchParams)) if (typeof v === 'string' && k !== 'page') pageQuery[k] = v;
  const labels: string[] = [];
  if (query.cycle) labels.push(taxonomy.cycles.find((c) => c.code === query.cycle)?.name ?? query.cycle);
  if (query.classe) labels.push(taxonomy.cycles.flatMap((c) => c.classes).find((c) => c.code === query.classe)?.name ?? query.classe);
  if (query.discipline) labels.push(taxonomy.disciplines.find((c) => c.code === query.discipline)?.name ?? query.discipline);
  if (query.theme) labels.push(taxonomy.themes.find((c) => c.code === query.theme)?.name ?? query.theme);

  return (
    <div>
      <div className="catalogue-heading mb-7 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-simen-blue/15 bg-white px-6 py-6 shadow-[0_8px_24px_rgba(0,153,204,.06)]">
        <div><p className="mb-1 text-xs font-bold uppercase tracking-[.12em] text-simen-orange-dark">Bibliothèque pédagogique</p><h1 className="text-3xl font-black">{query.q ? <>Résultats pour « {query.q} »</> : 'Catalogue'}{labels.length > 0 && <span className="text-simen-gray-mid"> · {labels.join(' · ')}</span>}</h1><p className="mt-2 max-w-2xl text-sm text-simen-gray">Des ressources validées, classées pour trouver rapidement le bon cours, la bonne capsule ou le bon audio.</p></div>
        <p className="rounded-full bg-simen-blue-light px-3 py-1.5 text-sm font-bold text-simen-blue-darker">{result.meta.total} contenu{result.meta.total > 1 ? 's' : ''}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Suspense fallback={<div className="card h-64 animate-pulse" />}><Filters taxonomy={taxonomy} total={result.meta.total} /></Suspense>
        <div>
          <MediaGrid items={result.items} emptyLabel={query.q ? 'Aucun résultat. Essayez d’autres mots-clés ou élargissez les filtres.' : 'Aucun contenu ne correspond à ces filtres.'} />
          <Pagination page={result.meta.page} pageCount={result.meta.pageCount} href={{ pathname: '/catalogue', query: pageQuery }} />
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import type { MediaCardDTO } from '@/lib/media';
import { formatDuration, formatNumber, LANGUAGE_LABELS } from '@/lib/utils';
import { StatusBadge } from '@/components/ui';

// Carte de catalogue — utilisable côté serveur comme côté client.
export function MediaCard({ m, showStatus, progress }: { m: MediaCardDTO; showStatus?: boolean; progress?: number }) {
  const href = `/media/${m.slug}`;
  return (
    <article className="media-card card group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(23,33,43,.12)] focus-within:ring-2 focus-within:ring-simen-blue">
      <Link href={href} className="relative block aspect-video bg-simen-gray-dark" aria-label={`${m.type === 'VIDEO' ? 'Vidéo' : 'Audio'} : ${m.title}`}>
        {m.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-simen-blue to-simen-blue-darker text-white">
            {m.type === 'VIDEO' ? <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg> : <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" /></svg>}
          </div>
        )}
        <span className={`absolute left-3 top-3 badge shadow-sm ${m.type === 'VIDEO' ? 'bg-simen-blue text-white' : 'bg-simen-orange text-white'}`}>{m.type === 'VIDEO' ? 'Vidéo' : 'Audio'}</span>
        {m.durationSec != null && <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-white">{formatDuration(m.durationSec)}</span>}
        {progress != null && m.durationSec ? <span className="absolute bottom-0 left-0 h-1 bg-simen-orange" style={{ width: `${Math.min(100, (progress / m.durationSec) * 100)}%` }} aria-hidden="true" /> : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="badge bg-simen-gray-lighter text-simen-gray">{m.classLevel.code}</span>
          <span className="badge text-white" style={{ backgroundColor: m.discipline.color }}>{m.discipline.name}</span>
          {m.language !== 'FR' && <span className="badge bg-simen-sky-light text-simen-blue-darker">{LANGUAGE_LABELS[m.language]}</span>}
          {showStatus && <StatusBadge status={m.status} />}
        </div>
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-simen-gray-dark"><Link href={href} className="hover:text-simen-blue">{m.title}</Link></h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-simen-gray">{m.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-simen-gray-lighter pt-3 text-[11px] text-simen-gray-mid">
          <Link href={`/chaines/${m.channel.slug}`} className="truncate hover:text-simen-blue">{m.channel.isOfficial && <span aria-label="Chaîne officielle" title="Chaîne officielle" className="mr-1 text-simen-blue">✔</span>}{m.channel.name}</Link>
          <span className="shrink-0">{formatNumber(m.viewCount)} vues</span>
        </div>
      </div>
    </article>
  );
}

export function MediaGrid({ items, showStatus, emptyLabel = 'Aucun contenu pour le moment.' }: { items: MediaCardDTO[]; showStatus?: boolean; emptyLabel?: string }) {
  if (items.length === 0) return <p className="card px-6 py-10 text-center text-sm text-simen-gray-mid">{emptyLabel}</p>;
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map((m) => <MediaCard key={m.id} m={m} showStatus={showStatus} />)}</div>;
}

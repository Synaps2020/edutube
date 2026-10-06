import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { findMediaByKey, isVisibleTo, toDetail, viewerFlags, mediaCardInclude, toCard } from '@/lib/media';
import { env } from '@/lib/env';
import { formatDate, formatNumber, LANGUAGE_LABELS, DIFFICULTY_LABELS } from '@/lib/utils';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { AudioPlayer } from '@/components/media/AudioPlayer';
import { MediaActions } from '@/components/media/MediaActions';
import { Comments } from '@/components/media/Comments';
import { MediaCard } from '@/components/media/MediaCard';
import { StatusBadge, Alert } from '@/components/ui';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const m = await findMediaByKey(params.slug);
  if (!m || m.status !== 'PUBLISHED') return { title: 'Contenu' };
  return { title: m.title, description: m.description.slice(0, 160), openGraph: { title: m.title, description: m.description.slice(0, 160), type: m.type === 'VIDEO' ? 'video.other' : 'music.song' } };
}

export default async function MediaPage({ params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  const raw = await findMediaByKey(params.slug);
  if (!raw || !isVisibleTo(raw, user)) notFound();
  const media = toDetail(raw);
  const [flags, related, subscribed] = await Promise.all([
    viewerFlags(media.id, user?.id ?? null),
    prisma.media.findMany({ where: { status: 'PUBLISHED', id: { not: media.id }, OR: [{ disciplineId: raw.disciplineId, classLevelId: raw.classLevelId }, { themeId: raw.themeId, cycleId: raw.cycleId }] }, include: mediaCardInclude, orderBy: { viewCount: 'desc' }, take: 6 }),
    user ? prisma.subscription.findUnique({ where: { userId_channelId: { userId: user.id, channelId: media.channel.id } } }) : null,
  ]);
  const ready = media.type === 'VIDEO' ? !!media.hlsUrl : !!media.audioUrl;
  const jsonLd = { '@context': 'https://schema.org', '@type': media.type === 'VIDEO' ? 'VideoObject' : 'AudioObject', name: media.title, description: media.description, thumbnailUrl: media.thumbnailUrl ?? undefined, uploadDate: media.publishedAt ?? undefined, duration: media.durationSec ? `PT${media.durationSec}S` : undefined, inLanguage: media.language.toLowerCase(), educationalLevel: media.classLevel.name, publisher: { '@type': 'Organization', name: 'Ministère de l’Éducation nationale du Sénégal' } };

  return (
    <div className="media-page grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article>
        {media.status !== 'PUBLISHED' && (
          <div className="mb-4"><Alert kind="warning"><StatusBadge status={media.status} /> Ce contenu n’est pas publié : seuls vous et les administrateurs pouvez le voir.{media.rejectionReason && <> Motif : {media.rejectionReason}</>}{media.processingError && <> Erreur : {media.processingError}</>}</Alert></div>
        )}
        {ready ? (
          media.type === 'VIDEO'
            ? <div className="rounded-2xl bg-simen-gray-dark p-1.5 shadow-[0_18px_40px_rgba(23,33,43,.18)]"><VideoPlayer slug={media.slug} hlsUrl={media.hlsUrl!} poster={media.thumbnailUrl} subtitlesUrl={media.subtitlesUrl} startAt={flags.positionSec} durationSec={media.durationSec} canTrack={!!user} title={media.title} /></div>
            : <AudioPlayer slug={media.slug} audioUrl={media.audioUrl!} waveformUrl={media.waveformUrl} startAt={flags.positionSec} durationSec={media.durationSec} canTrack={!!user} title={media.title} artist={media.pedagogicalAuthor} thumbnailUrl={media.thumbnailUrl} downloadable={media.downloadable && !!user} />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg bg-simen-gray-dark text-white"><p>Traitement du média en cours… Revenez dans quelques minutes.</p></div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          <span className={`badge ${media.type === 'VIDEO' ? 'bg-simen-blue text-white' : 'bg-simen-orange text-white'}`}>{media.type === 'VIDEO' ? 'Vidéo' : 'Audio'}</span>
          <Link href={`/catalogue?cycle=${media.cycle.code}`} className="badge bg-simen-gray-lighter text-simen-gray hover:bg-simen-sky-light">{media.cycle.name}</Link>
          <Link href={`/catalogue?cycle=${media.cycle.code}&classe=${media.classLevel.code}`} className="badge bg-simen-gray-lighter text-simen-gray hover:bg-simen-sky-light">{media.classLevel.name}</Link>
          <Link href={`/catalogue?discipline=${media.discipline.code}`} className="badge text-white" style={{ backgroundColor: media.discipline.color }}>{media.discipline.name}</Link>
          <Link href={`/catalogue?theme=${media.theme.code}`} className="badge border border-simen-blue/40 bg-white text-simen-blue-darker">{media.theme.name}</Link>
          <span className="badge bg-simen-sky-light text-simen-blue-darker">{LANGUAGE_LABELS[media.language]}</span>
          <span className="badge bg-simen-gray-lighter text-simen-gray">{DIFFICULTY_LABELS[media.difficulty]}</span>
        </div>
        <h1 className="mt-3 max-w-4xl text-2xl font-black leading-tight sm:text-3xl">{media.title}</h1>
        <p className="mt-1 text-sm text-simen-gray-mid">{formatNumber(media.viewCount)} vues · Publié le {formatDate(media.publishedAt)} · <Link href={`/chaines/${media.channel.slug}`} className="font-semibold text-simen-blue hover:underline">{media.channel.isOfficial && '✔ '}{media.channel.name}</Link></p>

        <div className="mt-4"><MediaActions media={media} viewer={{ ...flags, subscribed: !!subscribed }} appUrl={env.appUrl} /></div>

        <section className="card mt-6 border-simen-blue/15 p-6 shadow-[0_10px_26px_rgba(0,153,204,.06)]" aria-labelledby="desc">
          <h2 id="desc" className="sr-only">Description et métadonnées pédagogiques</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-simen-gray-dark">{media.description}</p>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-simen-gray">Chapitre</dt><dd>{media.chapter}</dd></div>
            <div><dt className="font-semibold text-simen-gray">Auteur pédagogique</dt><dd>{media.pedagogicalAuthor}</dd></div>
            <div><dt className="font-semibold text-simen-gray">Licence</dt><dd>{media.license}</dd></div>
            {media.contributor && <div><dt className="font-semibold text-simen-gray">Proposé par</dt><dd>{media.contributor.firstName} {media.contributor.lastName}</dd></div>}
            <div className="sm:col-span-2"><dt className="font-semibold text-simen-gray">Mots-clés</dt><dd className="mt-1 flex flex-wrap gap-1">{media.keywords.map((k) => <Link key={k} href={`/catalogue?q=${encodeURIComponent(k)}`} className="rounded bg-simen-gray-lighter px-2 py-0.5 text-xs hover:bg-simen-sky-light">#{k}</Link>)}</dd></div>
          </dl>
        </section>

        {media.transcript && (
          <details className="card mt-4 p-5">
            <summary className="cursor-pointer font-bold">Transcription {media.type === 'AUDIO' ? '(accessibilité)' : ''}</summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{media.transcript}</p>
          </details>
        )}

        <Comments slug={media.slug} initialCount={media.commentCount} />
      </article>

      <aside aria-labelledby="related-title" className="lg:sticky lg:top-24 lg:self-start">
        <h2 id="related-title" className="section-title text-base">Contenus associés</h2><p className="mb-4 text-xs leading-relaxed text-simen-gray-mid">Poursuivez votre parcours avec des ressources proches de ce contenu.</p>
        <div className="grid gap-3">{related.length === 0 ? <p className="text-sm text-simen-gray-mid">Pas encore de contenu associé.</p> : related.map((r) => <MediaCard key={r.id} m={toCard(r)} />)}</div>
      </aside>
    </div>
  );
}

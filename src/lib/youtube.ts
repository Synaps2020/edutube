// Utilitaires YouTube (chaîne officielle SIMEN / MEN).
// Aucune clé API n’est requise : oEmbed public + flux Atom RSS.

const YT_ID = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeVideoId(input: string): string | null {
  const s = input.trim();
  if (YT_ID.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && YT_ID.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && YT_ID.test(v)) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      for (const key of ['embed', 'shorts', 'live', 'v']) {
        const i = parts.indexOf(key);
        if (i >= 0 && parts[i + 1] && YT_ID.test(parts[i + 1])) return parts[i + 1];
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumbnailUrl(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(id: string, startAt = 0) {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
  if (startAt > 0) params.set('start', String(Math.floor(startAt)));
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

export function youtubeChannelUrl(handle: string) {
  const h = handle.replace(/^@/, '');
  return `https://www.youtube.com/@${h}`;
}

export function youtubeChannelEmbedUrl(handle: string) {
  const h = handle.replace(/^@/, '');
  return `https://www.youtube.com/embed?listType=user_uploads&list=${encodeURIComponent(h)}`;
}

export interface YoutubeOEmbed {
  title: string;
  authorName: string;
  thumbnailUrl: string;
  videoId: string;
}

export async function fetchYoutubeOEmbed(videoId: string): Promise<YoutubeOEmbed | null> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(videoId))}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
  return {
    title: data.title?.trim() || `Vidéo ${videoId}`,
    authorName: data.author_name?.trim() || 'SIMEN',
    thumbnailUrl: data.thumbnail_url || youtubeThumbnailUrl(videoId),
    videoId,
  };
}

export interface YoutubeFeedItem {
  id: string;
  title: string;
  description: string;
  publishedAt: string | null;
}

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseAtomFeed(xml: string): YoutubeFeedItem[] {
  const entries = xml.split('<entry>').slice(1);
  const out: YoutubeFeedItem[] = [];
  for (const raw of entries) {
    const id = raw.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      ?? raw.match(/watch\?v=([a-zA-Z0-9_-]{11})/)?.[1];
    if (!id || !YT_ID.test(id)) continue;
    const title = decodeXml(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const description = decodeXml(
      raw.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/)?.[1]
        ?? raw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]
        ?? '',
    );
    const publishedAt = raw.match(/<published>([^<]+)<\/published>/)?.[1] ?? null;
    out.push({ id, title: title || `Vidéo ${id}`, description: description.slice(0, 5000), publishedAt });
  }
  return out;
}

export async function resolveYoutubeChannelId(handle: string): Promise<string | null> {
  const h = handle.replace(/^@/, '').trim();
  if (/^UC[\w-]{22}$/.test(h)) return h;
  const res = await fetch(youtubeChannelUrl(h), { headers: { 'User-Agent': 'Mozilla/5.0 EduTube' }, redirect: 'follow' });
  if (!res.ok) return null;
  const html = await res.text();
  return html.match(/"channelId":"(UC[\w-]{22})"/)?.[1] ?? null;
}

export async function fetchYoutubeChannelFeed(handleOrId: string): Promise<YoutubeFeedItem[]> {
  const h = handleOrId.replace(/^@/, '').trim();
  const channelId = /^UC[\w-]{22}$/.test(h) ? h : await resolveYoutubeChannelId(h);
  const urls = [
    channelId ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}` : '',
    `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(h)}`,
  ].filter(Boolean);
  for (const url of urls) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 EduTube' } });
    if (!res.ok) continue;
    const items = parseAtomFeed(await res.text());
    if (items.length) return items;
  }
  return [];
}

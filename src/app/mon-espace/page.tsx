'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { MediaCard } from '@/components/media/MediaCard';
import { EmptyState, Spinner } from '@/components/ui';
import type { MediaCardDTO } from '@/lib/media';
import { formatDate, formatDuration } from '@/lib/utils';

export default function HistoriquePage() {
  const [items, setItems] = useState<Array<{ positionSec: number; completed: boolean; lastWatchedAt: string; media: MediaCardDTO }> | null>(null);
  useEffect(() => { api.get<NonNullable<typeof items>>('/me/history').then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <Spinner />;
  return (
    <div><h1 className="mb-4 text-2xl font-bold">Historique de visionnage</h1>
      {items.length === 0 ? <EmptyState title="Aucun contenu consulté pour le moment." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((h) => <div key={h.media.id}><MediaCard m={h.media} progress={h.positionSec} /><p className="mt-1 text-xs text-simen-gray-mid">{h.completed ? '✔ Terminé' : `Arrêté à ${formatDuration(h.positionSec)}`} · {formatDate(h.lastWatchedAt, true)}</p></div>)}</div>
      )}
    </div>
  );
}

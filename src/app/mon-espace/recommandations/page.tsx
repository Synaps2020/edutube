'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { MediaCard } from '@/components/media/MediaCard';
import { EmptyState, Spinner } from '@/components/ui';
import type { MediaCardDTO } from '@/lib/media';
import { formatDate, ROLE_LABELS } from '@/lib/utils';

interface R { id: string; message: string | null; createdAt: string; sender: { firstName: string; lastName: string; role: string }; classLevel: { name: string } | null; media: MediaCardDTO }

export default function RecommandationsPage() {
  const [items, setItems] = useState<R[] | null>(null);
  useEffect(() => { api.get<R[]>('/me/recommendations').then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <Spinner />;
  return (
    <div><h1 className="mb-4 text-2xl font-bold">Recommandations reçues</h1>
      {items.length === 0 ? <EmptyState title="Aucune recommandation pour le moment." hint="Vos enseignants et camarades peuvent vous recommander des contenus ou les diffuser à votre classe." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((r) => <div key={r.id}><MediaCard m={r.media} /><p className="mt-1 text-xs text-simen-gray-mid">{ROLE_LABELS[r.sender.role]} {r.sender.firstName} {r.sender.lastName}{r.classLevel ? ` → classe de ${r.classLevel.name}` : ''} · {formatDate(r.createdAt)}</p>{r.message && <p className="mt-1 rounded bg-simen-sky-light px-2 py-1 text-sm">« {r.message} »</p>}</div>)}</div>
      )}
    </div>
  );
}

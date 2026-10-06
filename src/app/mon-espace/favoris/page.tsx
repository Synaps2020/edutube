'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { MediaGrid } from '@/components/media/MediaCard';
import { Spinner } from '@/components/ui';
import type { MediaCardDTO } from '@/lib/media';

export default function FavorisPage() {
  const [items, setItems] = useState<Array<{ media: MediaCardDTO }> | null>(null);
  useEffect(() => { api.get<NonNullable<typeof items>>('/me/favorites').then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <Spinner />;
  return <div><h1 className="mb-4 text-2xl font-bold">Mes favoris</h1><MediaGrid items={items.map((i) => i.media)} emptyLabel="Aucun favori. Cliquez sur ☆ Favori sur un contenu pour le retrouver ici." /></div>;
}

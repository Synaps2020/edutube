'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useSession } from '@/lib/client/session-context';
import { EmptyState, Spinner } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';

interface N { id: string; type: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }

export default function NotificationsPage() {
  const { refresh } = useSession();
  const [data, setData] = useState<{ items: N[]; unread: number } | null>(null);
  const load = () => api.get<{ items: N[]; unread: number }>('/me/notifications').then(setData).catch(() => setData({ items: [], unread: 0 }));
  useEffect(() => { load(); }, []);
  const readAll = async () => { await api.post('/me/notifications/read-all'); load(); refresh(); };
  const read = async (n: N) => { if (!n.readAt) { await api.post(`/me/notifications/${n.id}/read`); refresh(); } };
  if (!data) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Notifications {data.unread > 0 && <span className="badge bg-simen-orange text-white">{data.unread}</span>}</h1>{data.unread > 0 && <button type="button" className="btn-secondary" onClick={readAll}>Tout marquer comme lu</button>}</div>
      {data.items.length === 0 ? <EmptyState title="Aucune notification." /> : (
        <ul className="card divide-y divide-simen-gray-lighter">{data.items.map((n) => (
          <li key={n.id} className={cn('p-4', !n.readAt && 'bg-simen-blue-light/50')}>
            <div className="flex items-start gap-3">
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.readAt ? 'bg-simen-gray-light' : 'bg-simen-orange')} aria-label={n.readAt ? 'lue' : 'non lue'} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{n.link ? <Link href={n.link} onClick={() => read(n)} className="hover:text-simen-blue">{n.title}</Link> : n.title}</p>
                {n.body && <p className="text-sm text-simen-gray">{n.body}</p>}
                <p className="mt-1 text-xs text-simen-gray-mid">{formatDate(n.createdAt, true)}</p>
              </div>
              {!n.readAt && <button type="button" className="text-xs text-simen-blue hover:underline" onClick={async () => { await read(n); load(); }}>Marquer lue</button>}
            </div>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

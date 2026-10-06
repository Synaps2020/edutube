'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { Pagination, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface Audit { id: string; action: string; entity: string | null; entityId: string | null; details: unknown; ip: string | null; createdAt: string; actor: { firstName: string; lastName: string; email: string; role: string } | null }
interface Decision { id: string; targetType: string; targetId: string; action: string; reason: string | null; createdAt: string; moderator: { firstName: string; lastName: string } }

export default function JournalPage() {
  const { toast } = useToast();
  const [type, setType] = useState<'audit' | 'moderation'>('audit');
  const [q, setQ] = useState(''); const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<Audit | Decision>; meta: { total: number; pageSize: number } } | null>(null);
  const load = useCallback(() => api.get<NonNullable<typeof data>>(`/admin/audit?${new URLSearchParams({ type, q, page: String(page) })}`).then(setData).catch((e) => toast(errorMessage(e), 'error')), [type, q, page, toast]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Journal d’audit</h1><a href="/api/v1/admin/export?type=audit" className="btn-secondary">Exporter en CSV</a></div>
      <div className="flex flex-wrap items-center gap-2"><div role="tablist" className="flex gap-2"><button type="button" role="tab" aria-selected={type === 'audit'} className={type === 'audit' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setType('audit'); setPage(1); }}>Actions administratives</button><button type="button" role="tab" aria-selected={type === 'moderation'} className={type === 'moderation' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setType('moderation'); setPage(1); }}>Décisions de modération</button></div>{type === 'audit' && <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} className="input w-56" placeholder="Action (MEDIA_PUBLISH…), entité, id" aria-label="Filtrer" /><button type="submit" className="btn-secondary">Filtrer</button></form>}</div>
      {!data ? <Spinner /> : (
        <div className="card overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b bg-simen-gray-lighter text-left uppercase text-simen-gray"><th className="p-2">Date</th><th className="p-2">{type === 'audit' ? 'Acteur' : 'Modérateur'}</th><th className="p-2">Action</th><th className="p-2">{type === 'audit' ? 'Entité' : 'Cible'}</th><th className="p-2">{type === 'audit' ? 'Détails / IP' : 'Motif'}</th></tr></thead>
          <tbody>{data.items.map((it) => type === 'audit' ? (() => { const a = it as Audit; return <tr key={a.id} className="border-b border-simen-gray-lighter align-top"><td className="whitespace-nowrap p-2">{formatDate(a.createdAt, true)}</td><td className="p-2">{a.actor ? `${a.actor.firstName} ${a.actor.lastName} (${a.actor.role})` : 'système / anonyme'}</td><td className="p-2 font-mono">{a.action}</td><td className="p-2">{a.entity}{a.entityId && <span className="text-simen-gray-mid"> {a.entityId}</span>}</td><td className="max-w-md truncate p-2 font-mono text-simen-gray-mid" title={JSON.stringify(a.details)}>{a.details ? JSON.stringify(a.details) : ''}{a.ip && <> · {a.ip}</>}</td></tr>; })() : (() => { const d = it as Decision; return <tr key={d.id} className="border-b border-simen-gray-lighter align-top"><td className="whitespace-nowrap p-2">{formatDate(d.createdAt, true)}</td><td className="p-2">{d.moderator.firstName} {d.moderator.lastName}</td><td className="p-2 font-mono">{d.action}</td><td className="p-2">{d.targetType} <span className="text-simen-gray-mid">{d.targetId}</span></td><td className="p-2">{d.reason}</td></tr>; })())}</tbody></table></div>
      )}
      {data && <Pagination page={page} pageCount={Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize))} onChange={setPage} />}
    </div>
  );
}

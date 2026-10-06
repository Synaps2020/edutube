'use client';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <span role="status" aria-label="Chargement" className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-simen-gray-light border-t-simen-blue', className)} />;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-simen-gray-light"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" fill="currentColor" /></svg>
      <p className="font-semibold text-simen-gray-dark">{title}</p>
      {hint && <p className="text-sm text-simen-gray-mid">{hint}</p>}
      {action}
    </div>
  );
}

export function Badge({ children, color = 'gray', className }: { children: React.ReactNode; color?: 'gray' | 'blue' | 'orange' | 'green' | 'red' | 'yellow'; className?: string }) {
  const map = {
    gray: 'bg-simen-gray-lighter text-simen-gray', blue: 'bg-simen-blue-light text-simen-blue-darker', orange: 'bg-simen-orange-light text-simen-orange-dark',
    green: 'bg-sn-green-light text-sn-green', red: 'bg-sn-red-light text-sn-red', yellow: 'bg-sn-yellow-light text-yellow-800',
  };
  return <span className={cn('badge', map[color], className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: 'gray' | 'blue' | 'orange' | 'green' | 'red' | 'yellow' }> = {
    DRAFT: { label: 'Brouillon', color: 'gray' }, PENDING: { label: 'En attente', color: 'orange' }, PROCESSING: { label: 'Traitement', color: 'blue' },
    PUBLISHED: { label: 'Publié', color: 'green' }, REJECTED: { label: 'Rejeté', color: 'red' }, ARCHIVED: { label: 'Archivé', color: 'gray' }, FAILED: { label: 'Échec', color: 'red' },
    APPROVED: { label: 'Approuvée', color: 'green' }, OPEN: { label: 'Ouvert', color: 'orange' }, RESOLVED: { label: 'Traité', color: 'green' }, DISMISSED: { label: 'Classé', color: 'gray' },
    VISIBLE: { label: 'Visible', color: 'green' }, HIDDEN: { label: 'Masqué', color: 'red' }, ACTIVE: { label: 'Actif', color: 'green' }, SUSPENDED: { label: 'Suspendu', color: 'red' },
    QUEUED: { label: 'En file', color: 'gray' }, RUNNING: { label: 'En cours', color: 'blue' }, DONE: { label: 'Terminé', color: 'green' },
  };
  const s = map[status] ?? { label: status, color: 'gray' as const };
  return <Badge color={s.color}>{s.label}</Badge>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className={cn('card max-h-[90vh] w-full overflow-y-auto p-6', wide ? 'max-w-3xl' : 'max-w-lg')} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded p-1 text-simen-gray-mid hover:bg-simen-gray-lighter">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, required, children }: { label: string; htmlFor?: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}{required && <span className="text-sn-red" aria-hidden="true"> *</span>}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-simen-gray-mid">{hint}</p>}
      {error && <p className="mt-1 text-xs text-sn-red" role="alert">{error}</p>}
    </div>
  );
}

// Pagination : soit par liens (pages serveur : `href` = chemin + paramètres sérialisables), soit par rappel (pages client).
export function Pagination({ page, pageCount, href, onChange }: { page: number; pageCount: number; href?: { pathname: string; query?: Record<string, string> }; onChange?: (p: number) => void }) {
  if (pageCount <= 1) return null;
  const hrefFor = href ? (p: number) => { const sp = new URLSearchParams(href.query ?? {}); sp.set('page', String(p)); return `${href.pathname}?${sp}`; } : undefined;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 2);
  const render = (p: number) => {
    const cls = cn('min-w-9 rounded-md border px-3 py-1.5 text-sm', p === page ? 'border-simen-blue bg-simen-blue text-white' : 'border-simen-gray-light bg-white hover:bg-simen-gray-lighter');
    return hrefFor ? <Link key={p} href={hrefFor(p)} className={cls} aria-current={p === page ? 'page' : undefined}>{p}</Link> : <button key={p} type="button" className={cls} onClick={() => onChange?.(p)} aria-current={p === page ? 'page' : undefined}>{p}</button>;
  };
  const out: React.ReactNode[] = [];
  pages.forEach((p, i) => { if (i > 0 && p - pages[i - 1] > 1) out.push(<span key={`e${p}`} className="px-1 text-simen-gray-mid">…</span>); out.push(render(p)); });
  return <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-center gap-1">{out}</nav>;
}

export function Stat({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: string; accent?: 'blue' | 'orange' | 'green' | 'red' }) {
  const bar = { blue: 'bg-simen-blue', orange: 'bg-simen-orange', green: 'bg-sn-green', red: 'bg-sn-red' }[accent ?? 'blue'];
  return (
    <div className="card flex gap-3 p-4">
      <div className={cn('w-1.5 shrink-0 rounded-full', bar)} aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-simen-gray-mid">{label}</p>
        <p className="text-2xl font-bold text-simen-gray-dark">{value}</p>
        {hint && <p className="text-xs text-simen-gray-mid">{hint}</p>}
      </div>
    </div>
  );
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'success' | 'error' | 'warning'; children: React.ReactNode }) {
  const cls = { info: 'border-simen-blue/40 bg-simen-blue-light text-simen-blue-darker', success: 'border-sn-green/40 bg-sn-green-light text-sn-green', error: 'border-sn-red/40 bg-sn-red-light text-sn-red', warning: 'border-simen-orange/50 bg-simen-orange-light text-simen-orange-dark' }[kind];
  return <div role={kind === 'error' ? 'alert' : 'status'} className={cn('rounded-md border px-4 py-3 text-sm', cls)}>{children}</div>;
}

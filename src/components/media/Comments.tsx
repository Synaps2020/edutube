'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/client/api';
import { useSession } from '@/lib/client/session-context';
import { useToast } from '@/lib/client/toast-context';
import { formatDate, ROLE_LABELS } from '@/lib/utils';
import { ReportModal } from './MediaActions';
import { Badge } from '@/components/ui';

interface Comment { id: string; content: string; status: string; createdAt: string; parentId: string | null; author: { id: string; firstName: string; lastName: string; role: string } }

export function Comments({ slug, initialCount }: { slug: string; initialCount: number }) {
  const { user } = useSession();
  const { toast } = useToast();
  const [items, setItems] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get<Comment[]>(`/media/${slug}/comments`).then((c) => { setItems(c); setLoaded(true); }).catch(() => setLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const c = await api.post<Comment>(`/media/${slug}/comments`, { content: text, parentId: replyTo });
      setItems((l) => [...l, c]); setText(''); setReplyTo(null);
      toast(c.status === 'PENDING' ? 'Commentaire envoyé : il sera visible après validation.' : 'Commentaire publié.', 'success');
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { if (!confirm('Supprimer ce commentaire ?')) return; try { await api.delete(`/comments/${id}`); setItems((l) => l.filter((c) => c.id !== id && c.parentId !== id)); } catch (err) { toast(errorMessage(err), 'error'); } };
  const hide = async (id: string, status: 'HIDDEN' | 'VISIBLE') => { try { await api.patch(`/admin/comments/${id}`, { status }); load(); } catch (err) { toast(errorMessage(err), 'error'); } };

  const roots = items.filter((c) => !c.parentId);
  const replies = (id: string) => items.filter((c) => c.parentId === id);

  const Item = ({ c, depth }: { c: Comment; depth: number }) => (
    <li className={depth ? 'ml-8 border-l-2 border-simen-gray-lighter pl-4' : ''}>
      <div className={`rounded-md p-3 ${c.status !== 'VISIBLE' ? 'bg-sn-red-light/50' : 'bg-white'}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-simen-gray-mid">
          <span className="font-semibold text-simen-gray-dark">{c.author.firstName} {c.author.lastName}</span>
          <Badge color={c.author.role === 'ADMIN' ? 'blue' : c.author.role === 'TEACHER' ? 'orange' : 'gray'}>{ROLE_LABELS[c.author.role]}</Badge>
          <time dateTime={c.createdAt}>{formatDate(c.createdAt, true)}</time>
          {c.status !== 'VISIBLE' && <Badge color="red">{c.status === 'HIDDEN' ? 'Masqué' : 'En attente de validation'}</Badge>}
        </div>
        <p className="mt-1 whitespace-pre-line text-sm">{c.content}</p>
        <div className="mt-2 flex gap-3 text-xs">
          {user && depth === 0 && <button type="button" className="text-simen-blue hover:underline" onClick={() => { setReplyTo(c.id); document.getElementById('comment-text')?.focus(); }}>Répondre</button>}
          {user && user.id !== c.author.id && <button type="button" className="text-simen-gray-mid hover:text-sn-red" onClick={() => setReportId(c.id)}>Signaler</button>}
          {user && (user.id === c.author.id || user.role === 'ADMIN') && <button type="button" className="text-simen-gray-mid hover:text-sn-red" onClick={() => remove(c.id)}>Supprimer</button>}
          {user?.role === 'ADMIN' && (c.status === 'VISIBLE' ? <button type="button" className="text-simen-gray-mid hover:text-sn-red" onClick={() => hide(c.id, 'HIDDEN')}>Masquer</button> : <button type="button" className="text-sn-green" onClick={() => hide(c.id, 'VISIBLE')}>Rendre visible</button>)}
        </div>
      </div>
      {replies(c.id).length > 0 && <ul className="mt-2 space-y-2">{replies(c.id).map((r) => <Item key={r.id} c={r} depth={depth + 1} />)}</ul>}
    </li>
  );

  return (
    <section id="commentaires" aria-labelledby="commentaires-titre" className="mt-8">
      <h2 id="commentaires-titre" className="section-title">Commentaires ({loaded ? items.filter((c) => c.status === 'VISIBLE').length : initialCount})</h2>
      {user ? (
        <form onSubmit={submit} className="card mb-4 p-4">
          {replyTo && <p className="mb-2 text-xs text-simen-blue">Réponse à un commentaire — <button type="button" className="underline" onClick={() => setReplyTo(null)}>annuler</button></p>}
          <label htmlFor="comment-text" className="label">Votre commentaire</label>
          <textarea id="comment-text" value={text} onChange={(e) => setText(e.target.value)} className="input" rows={3} maxLength={2000} required minLength={2} placeholder="Posez une question, partagez une remarque constructive… (voir la charte communautaire)" />
          <div className="mt-2 flex items-center justify-between text-xs text-simen-gray-mid"><Link href="/charte" className="hover:underline">Charte communautaire</Link><button type="submit" className="btn-primary" disabled={busy || text.trim().length < 2}>Publier</button></div>
        </form>
      ) : (
        <p className="card mb-4 p-4 text-sm text-simen-gray"><Link href="/connexion" className="font-semibold text-simen-blue">Connectez-vous</Link> pour commenter.</p>
      )}
      <ul className="space-y-3">{roots.map((c) => <Item key={c.id} c={c} depth={0} />)}</ul>
      {loaded && items.length === 0 && <p className="text-sm text-simen-gray-mid">Soyez le premier à commenter.</p>}
      {reportId && <ReportModal open onClose={() => setReportId(null)} targetType="COMMENT" targetId={reportId} />}
    </section>
  );
}

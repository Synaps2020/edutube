'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { MediaCard } from '@/components/media/MediaCard';
import { EmptyState, Spinner, Field } from '@/components/ui';
import type { MediaCardDTO } from '@/lib/media';

interface PL { id: string; title: string; description: string | null; isPublic: boolean; isOwner: boolean; owner: { firstName: string; lastName: string; role: string }; items: Array<{ position: number; media: MediaCardDTO }> }

export function PlaylistView({ id }: { id: string }) {
  const { toast } = useToast();
  const [pl, setPl] = useState<PL | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', isPublic: false });
  const load = () => api.get<PL>(`/playlists/${id}`).then((p) => { setPl(p); setForm({ title: p.title, description: p.description ?? '', isPublic: p.isPublic }); }).catch((e) => setError(errorMessage(e)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);
  const removeItem = async (mediaId: string) => { try { await api.delete(`/playlists/${id}/items?mediaId=${mediaId}`); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const save = async (e: React.FormEvent) => { e.preventDefault(); try { await api.patch(`/playlists/${id}`, form); setEdit(false); load(); toast('Liste mise à jour.', 'success'); } catch (err) { toast(errorMessage(err), 'error'); } };
  const copy = () => navigator.clipboard.writeText(`${location.origin}/listes/${id}`).then(() => toast('Lien copié.', 'success'));
  if (error) return <EmptyState title={error} />;
  if (!pl) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="card p-5">
        {edit ? (
          <form onSubmit={save} className="space-y-3">
            <Field label="Titre" htmlFor="t"><input id="t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" required /></Field>
            <Field label="Description" htmlFor="d"><textarea id="d" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={2} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="accent-simen-blue" />Liste publique (toute personne avec le lien peut la voir)</label>
            <div className="flex gap-2"><button type="submit" className="btn-primary">Enregistrer</button><button type="button" className="btn-secondary" onClick={() => setEdit(false)}>Annuler</button></div>
          </form>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{pl.title}</h1>
            <p className="text-sm text-simen-gray-mid">Par {pl.owner.firstName} {pl.owner.lastName} · {pl.items.length} contenu(s) · {pl.isPublic ? 'publique' : 'privée'}</p>
            {pl.description && <p className="mt-2 text-sm text-simen-gray">{pl.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {pl.isOwner && <button type="button" className="btn-secondary" onClick={() => setEdit(true)}>Modifier</button>}
              {pl.isPublic && <button type="button" className="btn-secondary" onClick={copy}>Copier le lien de partage</button>}
              {pl.isOwner && <Link href="/mon-espace/listes" className="btn-ghost">← Mes listes</Link>}
            </div>
          </>
        )}
      </div>
      {pl.items.length === 0 ? <EmptyState title="Cette liste est vide." hint="Ajoutez des contenus depuis leur page (bouton « + Liste de lecture »)." /> : (
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{pl.items.map((it, i) => <li key={it.media.id} className="relative"><span className="absolute -left-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-simen-orange text-xs font-bold text-white" aria-hidden="true">{i + 1}</span><MediaCard m={it.media} />{pl.isOwner && <button type="button" className="mt-1 text-xs text-sn-red hover:underline" onClick={() => removeItem(it.media.id)}>Retirer de la liste</button>}</li>)}</ol>
      )}
    </div>
  );
}

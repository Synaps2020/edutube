'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/client/api';
import { useSession } from '@/lib/client/session-context';
import { useToast } from '@/lib/client/toast-context';
import { Modal, Field } from '@/components/ui';
import type { MediaDetailDTO } from '@/lib/media';
import { formatNumber } from '@/lib/utils';

interface Props {
  media: MediaDetailDTO;
  viewer: { liked: boolean; favorited: boolean; subscribed: boolean };
  appUrl: string;
}

export function MediaActions({ media, viewer, appUrl }: Props) {
  const { user } = useSession();
  const { toast } = useToast();
  const [liked, setLiked] = useState(viewer.liked);
  const [likeCount, setLikeCount] = useState(media.likeCount);
  const [fav, setFav] = useState(viewer.favorited);
  const [subscribed, setSubscribed] = useState(viewer.subscribed);
  const [modal, setModal] = useState<null | 'share' | 'recommend' | 'playlist' | 'report'>(null);
  const needLogin = () => toast('Connectez-vous pour interagir avec les contenus.', 'info');

  const toggleLike = async () => {
    if (!user) return needLogin();
    try {
      const r = liked ? await api.delete<{ liked: boolean; likeCount: number }>(`/media/${media.slug}/like`) : await api.post<{ liked: boolean; likeCount: number }>(`/media/${media.slug}/like`);
      setLiked(r.liked); setLikeCount(r.likeCount);
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const toggleFav = async () => {
    if (!user) return needLogin();
    try {
      const r = fav ? await api.delete<{ favorited: boolean }>(`/media/${media.slug}/favorite`) : await api.post<{ favorited: boolean }>(`/media/${media.slug}/favorite`);
      setFav(r.favorited); toast(r.favorited ? 'Ajouté à vos favoris.' : 'Retiré de vos favoris.', 'success');
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const toggleSub = async () => {
    if (!user) return needLogin();
    try {
      const r = subscribed ? await api.delete<{ subscribed: boolean }>(`/channels/${media.channel.slug}/subscribe`) : await api.post<{ subscribed: boolean }>(`/channels/${media.channel.slug}/subscribe`);
      setSubscribed(r.subscribed); toast(r.subscribed ? `Abonné à « ${media.channel.name} ».` : 'Désabonné.', 'success');
    } catch (e) { toast(errorMessage(e), 'error'); }
  };

  const btn = 'btn-secondary';
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggleLike} aria-pressed={liked} className={liked ? 'btn bg-simen-blue text-white' : btn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.3a2 2 0 002-1.7l1.4-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></svg>
          J’aime · {formatNumber(likeCount)}
        </button>
        <button type="button" onClick={toggleFav} aria-pressed={fav} className={fav ? 'btn bg-simen-orange text-white' : btn}>{fav ? '★' : '☆'} Favori</button>
        <button type="button" onClick={() => setModal('share')} className={btn}>Partager</button>
        <button type="button" onClick={() => (user ? setModal('recommend') : needLogin())} className={btn}>Recommander</button>
        <button type="button" onClick={() => (user ? setModal('playlist') : needLogin())} className={btn}>+ Liste de lecture</button>
        {media.downloadable && media.type === 'VIDEO' && (user ? <a href={`/api/v1/media/${media.slug}/download`} className={btn} download>Télécharger</a> : <button type="button" onClick={needLogin} className={btn}>Télécharger</button>)}
        <button type="button" onClick={() => (user ? setModal('report') : needLogin())} className="btn-ghost text-sn-red hover:bg-sn-red-light">Signaler</button>
        <button type="button" onClick={toggleSub} aria-pressed={subscribed} className={`ml-auto ${subscribed ? 'btn-secondary' : 'btn-accent'}`}>{subscribed ? 'Abonné ✓' : 'S’abonner à la chaîne'}</button>
      </div>

      <ShareModal open={modal === 'share'} onClose={() => setModal(null)} media={media} appUrl={appUrl} />
      {user && <RecommendModal open={modal === 'recommend'} onClose={() => setModal(null)} media={media} />}
      {user && <PlaylistModal open={modal === 'playlist'} onClose={() => setModal(null)} mediaId={media.id} />}
      {user && <ReportModal open={modal === 'report'} onClose={() => setModal(null)} targetType="MEDIA" targetId={media.id} />}
    </>
  );
}

function ShareModal({ open, onClose, media, appUrl }: { open: boolean; onClose: () => void; media: MediaDetailDTO; appUrl: string }) {
  const { toast } = useToast();
  const shortUrl = `${appUrl}/v/${media.shortCode}`;
  const longUrl = `${appUrl}/media/${media.slug}`;
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); toast('Lien copié.', 'success'); } catch { toast('Copie impossible ; sélectionnez le texte.', 'error'); } };
  return (
    <Modal open={open} onClose={onClose} title="Partager ce contenu">
      <div className="space-y-4 text-sm">
        <Field label="Lien court"><div className="flex gap-2"><input readOnly value={shortUrl} className="input font-mono" onFocus={(e) => e.currentTarget.select()} /><button type="button" className="btn-primary" onClick={() => copy(shortUrl)}>Copier</button></div></Field>
        <Field label="Code court (à dicter ou écrire au tableau)"><p className="rounded bg-simen-blue-light px-3 py-2 text-center font-mono text-2xl font-bold tracking-widest text-simen-blue-darker">{media.shortCode}</p><p className="mt-1 text-xs text-simen-gray-mid">Les élèves peuvent saisir ce code sur la page d’accueil ou ouvrir {appUrl}/v/{media.shortCode}</p></Field>
        <Field label="Lien complet"><div className="flex gap-2"><input readOnly value={longUrl} className="input" onFocus={(e) => e.currentTarget.select()} /><button type="button" className="btn-secondary" onClick={() => copy(longUrl)}>Copier</button></div></Field>
        {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" className="btn-secondary w-full" onClick={() => navigator.share({ title: media.title, url: shortUrl }).catch(() => {})}>Partager via une application…</button>}
      </div>
    </Modal>
  );
}

function RecommendModal({ open, onClose, media }: { open: boolean; onClose: () => void; media: MediaDetailDTO }) {
  const { user } = useSession();
  const { toast } = useToast();
  const [mode, setMode] = useState<'user' | 'class'>('user');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ id: string; firstName: string; lastName: string; role: string; establishment: string | null; classLevel: { code: string } | null }>>([]);
  const [recipient, setRecipient] = useState<{ id: string; label: string } | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [classId, setClassId] = useState(user?.classLevelId ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get<{ cycles: Array<{ classes: Array<{ id: string; code: string; name: string }> }> }>('/taxonomy').then((t) => setClasses(t.cycles.flatMap((c) => c.classes))).catch(() => {});
  }, [open]);
  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const id = setTimeout(() => api.get<typeof results>(`/users/search?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(id);
  }, [q]);

  const send = async () => {
    setBusy(true);
    try {
      const body = mode === 'user' ? { recipientId: recipient?.id, message } : { classLevelId: classId, message };
      const r = await api.post<{ delivered: number }>(`/media/${media.slug}/recommend`, body);
      toast(mode === 'user' ? 'Recommandation envoyée.' : `Diffusé à ${r.delivered} élève(s) de la classe.`, 'success');
      onClose();
    } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  const canBroadcast = user?.role !== 'STUDENT' || !!user.classLevelId;
  return (
    <Modal open={open} onClose={onClose} title="Recommander ce contenu">
      <div className="space-y-4 text-sm">
        <div role="radiogroup" aria-label="Destinataire" className="flex gap-2">
          <button type="button" role="radio" aria-checked={mode === 'user'} onClick={() => setMode('user')} className={mode === 'user' ? 'btn-primary' : 'btn-secondary'}>À une personne</button>
          {canBroadcast && <button type="button" role="radio" aria-checked={mode === 'class'} onClick={() => setMode('class')} className={mode === 'class' ? 'btn-primary' : 'btn-secondary'}>À une classe</button>}
        </div>
        {mode === 'user' ? (
          <Field label="Rechercher un élève ou un enseignant" htmlFor="reco-q" hint="Nom, prénom ou adresse e-mail">
            <input id="reco-q" value={q} onChange={(e) => { setQ(e.target.value); setRecipient(null); }} className="input" placeholder="ex. Awa Faye" />
            {results.length > 0 && !recipient && (
              <ul className="card mt-1 max-h-48 overflow-auto py-1">
                {results.map((r) => <li key={r.id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-simen-blue-light" onClick={() => { setRecipient({ id: r.id, label: `${r.firstName} ${r.lastName}` }); setQ(`${r.firstName} ${r.lastName}`); }}>{r.firstName} {r.lastName} <span className="text-xs text-simen-gray-mid">— {r.role === 'TEACHER' ? 'Enseignant' : r.role === 'STUDENT' ? `Élève${r.classLevel ? ' ' + r.classLevel.code : ''}` : 'Administrateur'}{r.establishment ? ', ' + r.establishment : ''}</span></button></li>)}
              </ul>
            )}
            {recipient && <p className="mt-1 text-xs text-sn-green">Destinataire : {recipient.label}</p>}
          </Field>
        ) : (
          <Field label="Classe destinataire" htmlFor="reco-class">
            <select id="reco-class" value={classId} onChange={(e) => setClassId(e.target.value)} className="input" disabled={user?.role === 'STUDENT'}>
              <option value="">Choisir…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-simen-gray-mid">Tous les élèves rattachés à cette classe recevront une notification.</p>
          </Field>
        )}
        <Field label="Message (facultatif)" htmlFor="reco-msg"><textarea id="reco-msg" value={message} onChange={(e) => setMessage(e.target.value)} className="input" rows={3} maxLength={500} placeholder="ex. À regarder avant le contrôle de jeudi." /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Annuler</button><button type="button" className="btn-primary" disabled={busy || (mode === 'user' ? !recipient : !classId)} onClick={send}>Envoyer</button></div>
      </div>
    </Modal>
  );
}

function PlaylistModal({ open, onClose, mediaId }: { open: boolean; onClose: () => void; mediaId: string }) {
  const { toast } = useToast();
  const [lists, setLists] = useState<Array<{ id: string; title: string; isPublic: boolean; _count: { items: number } }>>([]);
  const [title, setTitle] = useState('');
  useEffect(() => { if (open) api.get<typeof lists>('/playlists').then(setLists).catch(() => {}); }, [open]);
  const add = async (id: string) => { try { await api.post(`/playlists/${id}/items`, { mediaId }); toast('Ajouté à la liste.', 'success'); onClose(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const create = async () => { try { const pl = await api.post<{ id: string }>('/playlists', { title, isPublic: false }); await add(pl.id); } catch (e) { toast(errorMessage(e), 'error'); } };
  return (
    <Modal open={open} onClose={onClose} title="Ajouter à une liste de lecture">
      <ul className="mb-4 max-h-60 divide-y divide-simen-gray-lighter overflow-auto text-sm">
        {lists.length === 0 && <li className="py-3 text-simen-gray-mid">Vous n’avez pas encore de liste.</li>}
        {lists.map((l) => <li key={l.id} className="flex items-center justify-between py-2"><span>{l.title} <span className="text-xs text-simen-gray-mid">({l._count.items}) {l.isPublic ? '· publique' : '· privée'}</span></span><button type="button" className="btn-primary py-1" onClick={() => add(l.id)}>Ajouter</button></li>)}
      </ul>
      <div className="flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Nouvelle liste : titre" aria-label="Titre de la nouvelle liste" /><button type="button" className="btn-secondary" disabled={!title.trim()} onClick={create}>Créer et ajouter</button></div>
    </Modal>
  );
}

export function ReportModal({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: 'MEDIA' | 'COMMENT'; targetId: string }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('CONTENU_INAPPROPRIE');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => { setBusy(true); try { await api.post('/reports', { targetType, targetId, reason, details }); toast('Merci, votre signalement a été transmis à la modération.', 'success'); onClose(); } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} title={targetType === 'MEDIA' ? 'Signaler ce contenu' : 'Signaler ce commentaire'}>
      <div className="space-y-4 text-sm">
        <Field label="Motif" htmlFor="rep-reason">
          <select id="rep-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="input">
            <option value="CONTENU_INAPPROPRIE">Contenu inapproprié</option><option value="ERREUR_PEDAGOGIQUE">Erreur pédagogique ou scientifique</option><option value="DROITS_AUTEUR">Atteinte aux droits d’auteur</option><option value="HARCELEMENT">Harcèlement / propos offensants</option><option value="SPAM">Spam / publicité</option><option value="AUTRE">Autre</option>
          </select>
        </Field>
        <Field label="Précisions (facultatif)" htmlFor="rep-details"><textarea id="rep-details" value={details} onChange={(e) => setDetails(e.target.value)} className="input" rows={4} maxLength={2000} placeholder="Indiquez par exemple le moment concerné (minute) et la nature du problème." /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Annuler</button><button type="button" className="btn-danger" disabled={busy} onClick={send}>Envoyer le signalement</button></div>
      </div>
    </Modal>
  );
}

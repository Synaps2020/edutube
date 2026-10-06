'use client';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';

export function SubscribeButton({ slug, initial, loggedIn }: { slug: string; initial: boolean; loggedIn: boolean }) {
  const [sub, setSub] = useState(initial);
  const { toast } = useToast();
  const toggle = async () => {
    if (!loggedIn) return toast('Connectez-vous pour vous abonner.', 'info');
    try { const r = sub ? await api.delete<{ subscribed: boolean }>(`/channels/${slug}/subscribe`) : await api.post<{ subscribed: boolean }>(`/channels/${slug}/subscribe`); setSub(r.subscribed); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return <button type="button" onClick={toggle} aria-pressed={sub} className={sub ? 'btn-secondary' : 'btn-accent'}>{sub ? 'Abonné ✓' : 'S’abonner'}</button>;
}

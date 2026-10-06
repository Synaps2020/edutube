'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/client/i18n-context';
import { useSession } from '@/lib/client/session-context';
import { api } from '@/lib/client/api';
import { LOCALES, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function Header() {
  const { t, locale } = useT();
  const { user, setUser } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState<Array<{ title: string; slug: string; type: string }>>([]);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const boxRef = useRef<HTMLFormElement>(null);

  useEffect(() => { setOpen(false); setMenu(false); setMobile(false); }, [pathname]);

  useEffect(() => {
    if (q.trim().length < 2) { setSugg([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(() => { api.get<typeof sugg>(`/search/suggest?q=${encodeURIComponent(q)}`, ctrl.signal).then((s) => { setSugg(s); setOpen(true); }).catch(() => {}); }, 200);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) { setOpen(false); router.push(`/catalogue?q=${encodeURIComponent(q.trim())}`); } };
  const logout = async () => { await api.post('/auth/logout'); setUser(null); router.push('/'); router.refresh(); };
  const changeLocale = (l: Locale) => { document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`; router.refresh(); };

  const navLink = (href: string, label: string) => (
    <Link href={href} className={cn('rounded-md px-3 py-2 text-sm font-semibold hover:bg-simen-blue-light hover:text-simen-blue-darker', pathname === href ? 'text-simen-blue' : 'text-simen-gray-dark')}>{label}</Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-[0_2px_16px_rgba(23,33,43,.08)] backdrop-blur">
      <a href="#contenu" className="sr-only sr-only-focusable">Aller au contenu principal</a>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg p-1" aria-label={`${t('app.name')} — ${t('nav.home')}`}>
          <Image src="/img/logo-dptic-edutube.svg" alt="DPTIC EduTube — Médias éducatifs numériques" width={260} height={75} priority className="h-10 w-auto sm:h-11" />
        </Link>

        <form onSubmit={submitSearch} role="search" className="relative mx-2 hidden flex-1 md:block" ref={boxRef}>
          <label htmlFor="recherche" className="sr-only">{t('nav.search')}</label>
          <input id="recherche" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => sugg.length && setOpen(true)} placeholder={t('search.placeholder')} className="w-full rounded-full border border-slate-300 bg-slate-50 px-5 py-2.5 pr-12 text-sm outline-none transition focus:border-simen-blue focus:bg-white focus:ring-4 focus:ring-simen-blue-light" autoComplete="off" aria-autocomplete="list" aria-controls="suggestions" />
          <button type="submit" aria-label={t('nav.search')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-600 hover:bg-slate-200">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </button>
          {open && sugg.length > 0 && (
            <ul id="suggestions" role="listbox" className="card absolute left-0 right-0 top-full mt-1 overflow-hidden py-1">
              {sugg.map((s) => (
                <li key={s.slug} role="option" aria-selected="false">
              <Link href={`/media/${s.slug}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-simen-blue-light">
                    <span className={cn('badge', s.type === 'VIDEO' ? 'bg-simen-blue-light text-simen-blue-darker' : 'bg-simen-orange-light text-simen-orange-dark')}>{s.type === 'VIDEO' ? t('media.video') : t('media.audio')}</span>
                    <span className="truncate">{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </form>

          <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-1 md:flex">
          {navLink('/catalogue', t('nav.catalog'))}
          {navLink('/chaines', t('nav.channels'))}
          {user && user.role !== 'ADMIN' && navLink('/soumettre', t('nav.submit'))}
          {user?.role === 'ADMIN' && navLink('/admin', t('nav.admin'))}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <label className="sr-only" htmlFor="langue">Langue de l’interface</label>
          <select id="langue" value={locale} onChange={(e) => changeLocale(e.target.value as Locale)} className="hidden rounded-md border border-simen-gray-light bg-white px-2 py-1.5 text-xs sm:block" aria-label="Langue de l’interface">
            {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          {user ? (
            <div className="relative">
              <button type="button" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} className="flex items-center gap-2 rounded-full border border-simen-gray-light bg-white py-1 pl-1 pr-3 text-sm transition hover:border-simen-blue hover:bg-simen-blue-light">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-simen-blue text-xs font-bold text-white" aria-hidden="true">{user.firstName[0]}{user.lastName[0]}</span>
                <span className="hidden max-w-[8rem] truncate sm:inline">{user.firstName}</span>
                {!!user.unreadNotifications && <span className="rounded-full bg-simen-orange px-1.5 text-[10px] font-bold text-white" aria-label={`${user.unreadNotifications} notifications non lues`}>{user.unreadNotifications}</span>}
              </button>
              {menu && (
                <ul role="menu" className="card absolute right-0 top-full mt-1 w-56 py-1 text-sm">
                  <li role="none"><Link role="menuitem" href="/mon-espace" className="block px-4 py-2 hover:bg-simen-blue-light">{t('nav.mySpace')}</Link></li>
                  <li role="none"><Link role="menuitem" href="/mon-espace/notifications" className="block px-4 py-2 hover:bg-simen-blue-light">{t('nav.notifications')}{!!user.unreadNotifications && ` (${user.unreadNotifications})`}</Link></li>
                  {user.role !== 'ADMIN' && <li role="none"><Link role="menuitem" href="/soumettre" className="block px-4 py-2 hover:bg-simen-blue-light">{t('nav.submit')}</Link></li>}
                  {user.role === 'ADMIN' && <li role="none"><Link role="menuitem" href="/admin" className="block px-4 py-2 hover:bg-simen-blue-light">{t('nav.admin')}</Link></li>}
                  <li role="none"><Link role="menuitem" href="/mon-espace/profil" className="block px-4 py-2 hover:bg-simen-blue-light">Mon profil</Link></li>
                  <li role="none"><button role="menuitem" type="button" onClick={logout} className="block w-full px-4 py-2 text-left text-sn-red hover:bg-sn-red-light">{t('nav.logout')}</button></li>
                </ul>
              )}
            </div>
          ) : (
            <>
              <Link href="/connexion" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-simen-blue-light sm:inline-flex">{t('nav.login')}</Link>
              <Link href="/inscription" className="rounded-full bg-simen-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-simen-blue-dark">{t('nav.register')}</Link>
            </>
          )}
          <button type="button" className="rounded-md p-2 md:hidden" aria-label="Menu" aria-expanded={mobile} onClick={() => setMobile((m) => !m)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
      {mobile && (
        <div className="border-t border-simen-gray-light/60 bg-white px-4 py-3 md:hidden">
          <form onSubmit={submitSearch} role="search" className="mb-2"><label htmlFor="recherche-m" className="sr-only">{t('nav.search')}</label><input id="recherche-m" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} className="input" /></form>
          <nav aria-label="Navigation mobile" className="flex flex-col">
            {navLink('/catalogue', t('nav.catalog'))}{navLink('/chaines', t('nav.channels'))}
            {user && user.role !== 'ADMIN' && navLink('/soumettre', t('nav.submit'))}
            {user?.role === 'ADMIN' && navLink('/admin', t('nav.admin'))}
            {!user && navLink('/connexion', t('nav.login'))}
          </nav>
        </div>
      )}
    </header>
  );
}

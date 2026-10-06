'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/client/session-context';
import { cn, ROLE_LABELS } from '@/lib/utils';

const NAV = [
  ['/mon-espace', 'Tableau de bord'], ['/mon-espace/historique', 'Historique'], ['/mon-espace/favoris', 'Favoris'], ['/mon-espace/listes', 'Listes de lecture'],
  ['/mon-espace/recommandations', 'Recommandations reçues'], ['/mon-espace/propositions', 'Mes propositions'], ['/mon-espace/notifications', 'Notifications'], ['/mon-espace/profil', 'Mon profil'],
];

export default function MonEspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="card h-fit p-4" aria-label="Menu de mon espace">
        {user && <div className="mb-4 border-b border-simen-gray-lighter pb-3"><p className="font-bold">{user.firstName} {user.lastName}</p><p className="text-xs text-simen-gray-mid">{ROLE_LABELS[user.role]}{user.classLevel ? ` · ${user.classLevel.code}` : ''}{user.establishment ? ` · ${user.establishment}` : ''}</p></div>}
        <nav className="flex flex-col gap-0.5 text-sm">
          {NAV.filter(([h]) => !(h === '/mon-espace/propositions' && user?.role === 'ADMIN')).map(([href, label]) => <Link key={href} href={href} className={cn('rounded-md px-3 py-2 hover:bg-simen-blue-light', pathname === href ? 'bg-simen-blue-light font-semibold text-simen-blue-darker' : '')} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
          {user?.role === 'ADMIN' && <Link href="/admin" className="mt-2 rounded-md px-3 py-2 font-semibold text-simen-orange-dark hover:bg-simen-orange-light">→ Administration</Link>}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}

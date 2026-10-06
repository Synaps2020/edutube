'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV: Array<[string, string]> = [
  ['/admin', 'Tableau de bord'], ['/admin/contenus', 'Contenus'], ['/admin/contenus/nouveau', '+ Téléverser'], ['/admin/moderation', 'Propositions à valider'],
  ['/admin/signalements', 'Signalements'], ['/admin/commentaires', 'Commentaires'], ['/admin/utilisateurs', 'Utilisateurs'], ['/admin/chaines', 'Chaînes'],
  ['/admin/taxonomie', 'Cycles, classes, disciplines'], ['/admin/journal', 'Journal d’audit'], ['/admin/parametres', 'Paramètres & exports'],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="admin-shell grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="admin-sidebar card h-fit p-3 lg:sticky lg:top-24" aria-label="Menu d’administration">
        <p className="mb-2 border-b border-simen-gray-lighter px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-simen-orange">Administration MEN</p>
        <nav className="flex flex-col gap-0.5 text-xs">
          {NAV.map(([href, label]) => <Link key={href} href={href} className={cn('rounded-md px-2.5 py-1.5 hover:bg-simen-blue-light', pathname === href ? 'bg-simen-blue-light font-semibold text-simen-blue-darker' : '')} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

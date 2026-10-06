import Link from 'next/link';
import Image from 'next/image';
import { getDictionary, type Locale } from '@/lib/i18n';

export function Footer({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  return (
    <footer className="mt-16 border-t border-simen-gray-light/60 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Image src="/img/logo-simen.png" alt="SIMEN" width={150} height={81} className="h-14 w-auto" />
          <p className="mt-3 max-w-md text-sm leading-relaxed text-simen-gray">{d['app.tagline']}</p>
          <p className="mt-2 text-xs text-simen-gray-mid">Plateforme opérée par le SIMEN — Système d’Information de Management de l’Éducation Nationale.</p>
        </div>
        <nav aria-label="Liens utiles" className="text-sm">
          <p className="mb-2 font-bold text-simen-gray-dark">Plateforme</p>
          <ul className="space-y-1 text-simen-gray">
            <li><Link href="/catalogue" className="hover:text-simen-blue">{d['nav.catalog']}</Link></li>
            <li><Link href="/chaines" className="hover:text-simen-blue">{d['nav.channels']}</Link></li>
            <li><Link href="/soumettre" className="hover:text-simen-blue">{d['nav.submit']}</Link></li>
            <li><Link href="/a-propos" className="hover:text-simen-blue">{d['footer.about']}</Link></li>
          </ul>
        </nav>
        <nav aria-label="Informations légales" className="text-sm">
          <p className="mb-2 font-bold text-simen-gray-dark">Informations</p>
          <ul className="space-y-1 text-simen-gray">
            <li><Link href="/charte" className="hover:text-simen-blue">{d['footer.charter']}</Link></li>
            <li><Link href="/mentions-legales" className="hover:text-simen-blue">{d['footer.legal']}</Link></li>
            <li><Link href="/accessibilite" className="hover:text-simen-blue">Accessibilité</Link></li>
            <li><a href="/api/v1/health" className="hover:text-simen-blue">État du service</a></li>
          </ul>
        </nav>
      </div>
      <div className="tricolore h-1 w-full" aria-hidden="true" />
      <div className="bg-simen-gray-dark py-3 text-center text-xs text-simen-gray-light">
        © {new Date().getFullYear()} {d['footer.ministry']} — « Un Peuple, Un But, Une Foi »
      </div>
    </footer>
  );
}

import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <p className="text-6xl font-bold text-simen-blue">404</p>
      <h1 className="mt-2 text-xl font-bold">Page ou contenu introuvable</h1>
      <p className="mt-2 text-sm text-simen-gray">Le contenu a peut-être été retiré, ou le lien est erroné.</p>
      <div className="mt-4 flex justify-center gap-2"><Link href="/" className="btn-primary">Accueil</Link><Link href="/catalogue" className="btn-secondary">Catalogue</Link></div>
    </div>
  );
}

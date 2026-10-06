'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <h1 className="text-xl font-bold">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-simen-gray">Le service rencontre une difficulté temporaire. Si le problème persiste, contactez l’administrateur.</p>
      <button type="button" className="btn-primary mt-4" onClick={reset}>Réessayer</button>
    </div>
  );
}

'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Saisie d'un code court dicté par l'enseignant (ex. écrit au tableau) → redirection vers le contenu.
export function ShortCodeForm() {
  const [code, setCode] = useState('');
  const router = useRouter();
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) router.push(`/v/${code.trim()}`); }} className="rounded-lg border border-simen-sky bg-simen-sky-light p-5">
      <label htmlFor="code-court" className="block text-sm font-bold text-simen-gray-dark">Vous avez un code court ?</label>
      <p className="mb-3 text-xs text-simen-gray">Saisissez le code communiqué par votre enseignant pour ouvrir directement le contenu.</p>
      <div className="flex gap-2">
        <input id="code-court" value={code} onChange={(e) => setCode(e.target.value)} className="input font-mono uppercase tracking-widest" placeholder="ex. Kf3m9pQ" maxLength={12} autoComplete="off" />
        <button type="submit" className="btn-primary">Ouvrir</button>
      </div>
    </form>
  );
}

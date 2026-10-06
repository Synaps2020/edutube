'use client';
import { createContext, useCallback, useContext, useState } from 'react';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; message: string }
const ToastContext = createContext<{ toast: (message: string, kind?: Kind) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((message: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, kind, message }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 5000);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-lg ${t.kind === 'success' ? 'border-sn-green/40 bg-sn-green-light text-sn-green' : t.kind === 'error' ? 'border-sn-red/40 bg-sn-red-light text-sn-red' : 'border-simen-blue/40 bg-simen-blue-light text-simen-blue-darker'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

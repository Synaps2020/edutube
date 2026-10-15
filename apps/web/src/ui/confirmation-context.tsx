import { createContext, useContext } from 'react';
export interface Confirmation {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}
export const ConfirmationContext = createContext<
  ((request: Confirmation) => Promise<boolean>) | null
>(null);
export function useConfirmation() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) {
    throw new Error('ConfirmationProvider manquant');
  }
  return confirm;
}

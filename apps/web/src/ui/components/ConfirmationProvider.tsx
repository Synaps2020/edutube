import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { ConfirmationContext, type Confirmation } from '../confirmation-context';
interface Decision {
  request: Confirmation;
  resolve: (value: boolean) => void;
}
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const active = useRef<Decision | null>(null);
  const queue = useRef<Decision[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const advance = useCallback(() => {
    active.current = queue.current.shift() ?? null;
    setRequest(active.current?.request ?? null);
  }, []);
  const confirm = useCallback(
    (value: Confirmation) =>
      new Promise<boolean>((resolve) => {
        queue.current.push({ request: value, resolve });
        if (!active.current) {
          advance();
        }
      }),
    [advance],
  );
  const settle = useCallback(
    (accepted: boolean) => {
      active.current?.resolve(accepted);
      active.current = null;
      advance();
    },
    [advance],
  );
  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (request) {
      if (!element.open) {
        previousFocus.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        element.showModal();
      }
      cancelButton.current?.focus();
    } else if (element.open) {
      element.close();
      previousFocus.current?.focus();
    }
  }, [request]);
  useEffect(
    () => () => {
      active.current?.resolve(false);
      for (const decision of queue.current) {
        decision.resolve(false);
      }
      queue.current = [];
      active.current = null;
    },
    [],
  );
  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {createPortal(
        <dialog
          ref={dialog}
          className="confirmation-dialog"
          aria-labelledby="confirmation-title"
          aria-describedby="confirmation-message"
          onCancel={(event) => {
            event.preventDefault();
            settle(false);
          }}
          onClick={(event) => {
            if (event.target === dialog.current) {
              settle(false);
            }
          }}
        >
          {request && (
            <div className="confirmation-card">
              <button
                type="button"
                className="confirmation-close"
                aria-label="Fermer la confirmation"
                onClick={() => settle(false)}
              >
                <X size={20} />
              </button>
              <div className="confirmation-icon">
                <AlertTriangle size={25} />
              </div>
              <span className="eyebrow">PRENEZ UN INSTANT</span>
              <h2 id="confirmation-title">{request.title}</h2>
              <p id="confirmation-message">{request.message}</p>
              <div className="confirmation-actions">
                <button
                  ref={cancelButton}
                  type="button"
                  className="button button-secondary"
                  onClick={() => settle(false)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className={`button ${request.danger ? 'button-danger' : ''}`}
                  onClick={() => settle(true)}
                >
                  {request.confirmLabel}
                </button>
              </div>
            </div>
          )}
        </dialog>,
        document.body,
      )}
    </ConfirmationContext.Provider>
  );
}

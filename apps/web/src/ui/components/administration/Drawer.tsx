import { useEffect, useRef, type ReactNode } from 'react';
export function AdminDrawer({
  children,
  onClose,
  busy = false,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  label: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="ops-drawer admin-page"
      ref={dialog}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === dialog.current && !busy) {
          onClose();
        }
      }}
    >
      <div className="ops-drawer-body">{children}</div>
    </dialog>
  );
}

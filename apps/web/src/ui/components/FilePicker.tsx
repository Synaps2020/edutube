import type { Ref } from 'react';
export function FilePicker({
  label,
  ariaLabel,
  accept,
  fileName,
  inputRef,
  disabled,
  onChoose,
}: {
  label: string;
  ariaLabel: string;
  accept: string;
  fileName: string | null;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
  onChoose: (file: File | null) => void;
}) {
  return (
    <label className="teacher-field">
      <span>{label}</span>
      <span className="file-picker">
        <input
          ref={inputRef}
          type="file"
          aria-label={ariaLabel}
          accept={accept}
          disabled={disabled}
          onChange={(event) => onChoose(event.target.files?.[0] ?? null)}
        />
        <span>Choisir un fichier</span>
        <small>{fileName ?? 'Aucun fichier sélectionné'}</small>
      </span>
    </label>
  );
}

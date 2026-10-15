import type { TeachingCourse } from '@edutube/contracts/teaching';
export interface TeachingEditorProps {
  selected: TeachingCourse;
  disabled: boolean;
  change: (patch: Partial<TeachingCourse>) => void;
}
export function TextField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="teacher-field">
      <span>{label}</span>
      {multiline ? (
        <textarea required value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input required value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

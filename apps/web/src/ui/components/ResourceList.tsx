import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import type { ResourceDto } from '@edutube/contracts';
import { downloadDocument } from '../../adapters/browser-download';
export function documentSize(bytes: number | null) {
  if (bytes === null) {
    return '';
  }
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(bytes / 1024))} Ko`
    : `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}
export function ResourceList({ resources }: { resources: ResourceDto[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const download = async (resource: ResourceDto) => {
    setPending(resource.id);
    setError('');
    try {
      await downloadDocument(resource);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Le téléchargement a échoué.');
    } finally {
      setPending(null);
    }
  };
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {!resources.length ? (
        <p>Aucun document n’est joint à ce chapitre pour le moment.</p>
      ) : (
        resources.map((resource) => (
          <button
            type="button"
            key={resource.id}
            className="resource-download"
            disabled={!!pending}
            onClick={() => void download(resource)}
          >
            <FileText size={23} />
            <div>
              <strong>{resource.title}</strong>
              <small>
                {resource.fileName} · {documentSize(resource.sizeBytes)}
              </small>
            </div>
            <Download size={23} />
            {pending === resource.id && <span role="status">Téléchargement…</span>}
          </button>
        ))
      )}
    </>
  );
}

import { useState } from 'react';
import { useAuth } from '../auth-context';
import { legacyData, importLegacy } from '../../adapters/http/legacy-import';
export function LegacyImport() {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const accountId = session?.learner.id;
  if (!accountId) {
    return null;
  }
  const legacy = legacyData(accountId);
  if (!legacy.available) {
    return legacy.skipped ? (
      <p role="status">
        {legacy.skipped} élément(s) déjà présent(s) ou indisponible(s) n’ont pas été remplacés. Les
        données d’origine restent sur cet appareil.
      </p>
    ) : message ? (
      <p role="status">{message}</p>
    ) : null;
  }
  const importData = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await importLegacy(session);
      if (result.skipped) {
        setMessage(
          `${result.skipped} élément(s) déjà présent(s) ou indisponible(s) n’ont pas été remplacés. Les données d’origine restent sur cet appareil.`,
        );
      }
      window.location.reload();
    } catch (failure) {
      setMessage(
        failure instanceof Error
          ? failure.message
          : 'Import interrompu. Vous pouvez réessayer sans créer de doublons.',
      );
      setBusy(false);
    }
  };
  return (
    <div className="panel legacy-import">
      <h3>Retrouvez vos données de cet appareil</h3>
      <p>
        {legacy.counts.courses} cours, {legacy.counts.favorites} favoris et {legacy.counts.notes}{' '}
        notes peuvent être ajoutés à votre compte. Les notes déjà enregistrées seront conservées.
      </p>
      <button className="button button-secondary" disabled={busy} onClick={() => void importData()}>
        {busy ? 'Import en cours…' : 'Importer dans mon compte'}
      </button>
      {message && <p role="alert">{message}</p>}
    </div>
  );
}

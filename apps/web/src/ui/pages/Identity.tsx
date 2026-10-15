import { useProfileEditor } from '../profile-editor';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { identityService } from '../../adapters/http/identity';
import { useAuth } from '../auth-context';
export function ProfilePage() {
  const { profile, message, error, busy, save, verify } = useProfileEditor();
  return (
    <section className="container section profile-layout">
      <div className="auth-story">
        <span className="eyebrow">VOTRE COMPTE</span>
        <h1>Faites place à votre prochain chapitre.</h1>
        <p>Gardez vos informations à jour pour retrouver vos cours et votre progression.</p>
        <Link to="/mon-espace">Retour à mon apprentissage →</Link>
      </div>
      <div className="auth-card">
        <h2>Mon profil</h2>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="profile-notice" role="status">
            {message}
          </p>
        )}
        {!profile ? (
          <p>Chargement du profil…</p>
        ) : (
          <>
            <div className="profile-email">
              <strong>{profile.email}</strong>
              <span>{profile.emailVerified ? '✓ Adresse vérifiée' : 'Adresse à vérifier'}</span>
              {!profile.emailVerified && (
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => void verify()}
                >
                  Recevoir le lien de vérification
                </button>
              )}
            </div>
            <form onSubmit={save} key={profile.version}>
              <label>
                Votre nom
                <input
                  name="displayName"
                  defaultValue={profile.displayName}
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
              <label>
                Votre niveau
                <select name="schoolLevel" defaultValue={profile.schoolLevel ?? ''}>
                  <option value="">Non renseigné</option>
                  <option value="PRIMARY">Primaire</option>
                  <option value="MIDDLE">Collège</option>
                  <option value="SECONDARY">Lycée</option>
                </select>
              </label>
              <label>
                Quelques mots sur vous
                <textarea
                  name="biography"
                  defaultValue={profile.biography}
                  maxLength={2000}
                  rows={4}
                />
              </label>
              <button className="button" disabled={busy}>
                {busy ? 'Un instant…' : 'Enregistrer mon profil'}
              </button>
            </form>
            <Link className="text-link" to="/mot-de-passe-oublie">
              Changer mon mot de passe par e-mail →
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
export function RecoveryPage({ mode }: { mode: 'forgot' | 'reset' | 'verify' }) {
  const location = useLocation();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const { session, refresh } = useAuth();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (mode === 'reset' && form.get('password') !== form.get('confirmation')) {
        throw new Error('Les deux mots de passe doivent être identiques.');
      }
      const result =
        mode === 'forgot'
          ? await identityService.forgot(String(form.get('email')))
          : mode === 'verify'
            ? await identityService.verify(token)
            : await identityService.reset(token, String(form.get('password')));
      setMessage(result.message);
      setDone(true);
      if (mode !== 'forgot') {
        window.history.replaceState(null, '', location.pathname);
      }
      if (mode === 'verify' && session) {
        await refresh();
      }
      if (mode === 'reset' && session) {
        await refresh();
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Demande indisponible.');
    } finally {
      setBusy(false);
    }
  };
  const title =
    mode === 'forgot'
      ? 'Mot de passe oublié ?'
      : mode === 'reset'
        ? 'Un nouveau départ.'
        : 'Confirmez votre adresse.';
  return (
    <section className="container auth-layout section">
      <div className="auth-story">
        <span className="eyebrow">VOTRE ESPACE VOUS ATTEND</span>
        <h1>{title}</h1>
        <p>
          {mode === 'forgot'
            ? 'Recevez un lien pour choisir un nouveau mot de passe.'
            : 'Un lien personnel, utilisable une seule fois.'}
        </p>
      </div>
      <div className="auth-card">
        <h2>{title}</h2>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="profile-notice" role="status">
            {message}
          </p>
        )}
        {!done && (
          <form onSubmit={submit}>
            {mode === 'forgot' && (
              <label>
                Adresse e-mail
                <input name="email" type="email" required autoComplete="email" maxLength={254} />
              </label>
            )}
            {mode === 'reset' && (
              <>
                <label>
                  Nouveau mot de passe
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={200}
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Confirmer le mot de passe
                  <input
                    name="confirmation"
                    type="password"
                    required
                    minLength={12}
                    maxLength={200}
                    autoComplete="new-password"
                  />
                </label>
                <p>Au moins 12 caractères.</p>
              </>
            )}
            <button className="button" disabled={busy || (mode !== 'forgot' && !token)}>
              {busy
                ? 'Un instant…'
                : mode === 'verify'
                  ? 'Vérifier mon adresse'
                  : mode === 'forgot'
                    ? 'Recevoir un lien'
                    : 'Enregistrer le mot de passe'}
            </button>
            {mode !== 'forgot' && !token && (
              <p role="alert">Ouvrez le lien reçu par e-mail pour continuer.</p>
            )}
          </form>
        )}
        <Link className="text-link" to="/connexion">
          Retour à la connexion →
        </Link>
        {mode !== 'forgot' && (
          <Link className="text-link" to={mode === 'verify' ? '/profil' : '/mot-de-passe-oublie'}>
            Demander un nouveau lien →
          </Link>
        )}
      </div>
    </section>
  );
}

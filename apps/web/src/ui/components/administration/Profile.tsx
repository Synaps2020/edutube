import {
  ShieldCheck,
  Mail,
  CheckCircle2,
  LockKeyhole,
  Save,
  UserRound,
  ArrowUpRight,
} from 'lucide-react';
import { useProfileEditor } from '../../profile-editor';
import { useAuth } from '../../auth-context';
export function AdminProfilePanel() {
  const { profile, message, error, busy, save, verify, requestPassword } = useProfileEditor();
  const { session } = useAuth();
  const role = session?.learner.role === 'SUPER_ADMIN' ? 'Super-administrateur' : 'Régulateur';
  if (!profile) {
    return (
      <div className="account-loading" role={error ? 'alert' : 'status'}>
        {error || 'Chargement de votre compte…'}
      </div>
    );
  }
  return (
    <div className="account-settings">
      <aside className="account-identity">
        <span className="account-avatar">
          {profile.displayName
            .split(' ')
            .map((word) => word[0])
            .slice(0, 2)
            .join('')}
        </span>
        <h2>{profile.displayName}</h2>
        <span className="account-role">
          <ShieldCheck size={14} />
          {role}
        </span>
        <div className="account-identity-email">
          <Mail size={16} />
          <span>{profile.email}</span>
        </div>
        <div className={`account-verified ${profile.emailVerified ? '' : 'pending'}`}>
          <CheckCircle2 size={14} />
          {profile.emailVerified ? 'Adresse e-mail vérifiée' : 'Adresse e-mail à vérifier'}
        </div>
        <div className="account-scope">
          <span>VOTRE PÉRIMÈTRE</span>
          <p>
            {session?.learner.role === 'SUPER_ADMIN'
              ? 'Gestion des comptes, des accès et des contenus. Supervision de la modération.'
              : 'Vérification des contenus, modération et suivi de vos interventions.'}
          </p>
        </div>
      </aside>
      <div className="account-panels">
        {error && (
          <p role="alert" className="account-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="account-success">
            <CheckCircle2 size={17} />
            {message}
          </p>
        )}
        <section className="account-panel">
          <div className="account-panel-heading">
            <span>
              <UserRound size={20} />
            </span>
            <div>
              <h2>Informations personnelles</h2>
              <p>Votre nom identifie vos interventions dans la console.</p>
            </div>
          </div>
          <form onSubmit={save} key={profile.version}>
            <label>
              Nom complet
              <input
                name="displayName"
                defaultValue={profile.displayName}
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                disabled={busy}
              />
            </label>
            <label>
              Adresse e-mail
              <div className="account-readonly">
                <Mail size={16} />
                {profile.email}
                <LockKeyhole size={13} />
              </div>
              <small>
                Cette adresse est utilisée pour la connexion et les messages de sécurité.
              </small>
            </label>
            <label>
              Présentation <span className="account-optional">Facultatif</span>
              <textarea
                name="biography"
                defaultValue={profile.biography}
                maxLength={2000}
                rows={4}
                disabled={busy}
              />
            </label>
            <div className="account-form-footer">
              <p>Votre rôle et vos autorisations ne sont pas modifiés ici.</p>
              <button type="submit" className="button" disabled={busy}>
                <Save size={15} />
                {busy ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </section>
        <section className="account-panel">
          <div className="account-panel-heading">
            <span>
              <LockKeyhole size={20} />
            </span>
            <div>
              <h2>Sécurité du compte</h2>
              <p>Protégez l’accès à votre espace d’administration.</p>
            </div>
          </div>
          <div className="account-security-row">
            <div>
              <h3>Mot de passe</h3>
              <p>Recevez un lien personnel pour choisir un nouveau mot de passe.</p>
            </div>
            <button
              className="account-secondary"
              type="button"
              disabled={busy}
              onClick={() => void requestPassword()}
            >
              Recevoir le lien
              <ArrowUpRight size={15} />
            </button>
          </div>
          {!profile.emailVerified && (
            <div className="account-security-row">
              <div>
                <h3>Vérification de l’adresse</h3>
                <p>Confirmez votre adresse depuis le lien envoyé par e-mail.</p>
              </div>
              <button
                className="account-secondary"
                type="button"
                disabled={busy}
                onClick={() => void verify()}
              >
                Vérifier mon adresse
                <ArrowUpRight size={15} />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

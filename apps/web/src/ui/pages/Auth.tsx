import { useState, type FormEvent } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Eye, EyeOff, Play, Check } from 'lucide-react';
import { useAuth, returnPath } from '../auth-context';
export function AuthPage() {
  const [params] = useSearchParams();
  const { session, loading, error: sessionError, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const target = returnPath(params.get('retour'));
  if (loading) {
    return <p className="container section">Vérification de votre session…</p>;
  }
  if (session) {
    const destination =
      !params.has('retour') && ['SUPER_ADMIN', 'REGULATOR'].includes(session.learner.role)
        ? '/administration'
        : target;
    return <Navigate replace to={destination} />;
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const input = { email: String(form.get('email')), password: String(form.get('password')) };
    try {
      if (mode === 'register') {
        await register({ ...input, displayName: String(form.get('displayName')) });
      } else {
        await login(input);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Connexion indisponible. Réessayez.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="login-page">
      <div className="login-story">
        <div className="login-story-top">
          <span className="login-mark">
            <BookOpen size={22} /> EduTube<span>.</span>
          </span>
          <span>LE SAVOIR SE PARTAGE</span>
        </div>
        <div className="login-editorial">
          <span className="eyebrow">LE PROCHAIN CHAPITRE, C’EST VOUS.</span>
          <h1>
            La curiosité
            <br />
            vous va <em>si bien.</em>
          </h1>
          <p>
            Un cours qui fait tilt. Une idée qui grandit.
            <br />
            Et ce petit « j’ai compris » qui change tout.
          </p>
        </div>
        <div className="login-visual">
          <img
            src="/img/learning-campaign.png"
            alt="Apprendre et ouvrir de nouvelles perspectives"
          />
          <span className="login-sticker">
            <Play size={19} fill="currentColor" />À votre rythme.
            <br />
            Dans votre direction.
          </span>
          <span className="login-orbit" aria-hidden="true">
            ✳
          </span>
        </div>
        <div className="login-story-bottom">
          <span>
            <Check size={17} /> Des cours gratuits, pour avancer.
          </span>
          <Link to="/catalogue">
            Explorer les cours <ArrowRight size={18} />
          </Link>
        </div>
      </div>
      <div className="auth-card login-card">
        <div className="study-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            aria-pressed={mode === 'login'}
            disabled={busy}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Connexion
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            aria-pressed={mode === 'register'}
            disabled={busy}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Créer un compte
          </button>
        </div>
        <span className="eyebrow login-welcome">VOTRE PLACE EST ICI</span>
        <h2>{mode === 'login' ? 'Content de vous retrouver.' : 'Bienvenue sur EduTube.'}</h2>
        <p className="login-intro">
          {mode === 'login'
            ? 'Reprenez le fil de vos découvertes.'
            : 'Votre prochaine découverte commence ici.'}
        </p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Votre nom
              <input
                name="displayName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
              />
            </label>
          )}
          <label>
            Adresse e-mail
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label>
            Mot de passe
            <span className="login-password">
              <input
                name="password"
                type={visible ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'register' ? 12 : 1}
                maxLength={200}
              />
              <button
                type="button"
                aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={visible}
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          {mode === 'login' && (
            <Link className="text-link" to="/mot-de-passe-oublie">
              Mot de passe oublié ?
            </Link>
          )}
          {mode === 'register' && <p className="note-status">Choisissez au moins 12 caractères.</p>}
          {(error || sessionError) && (
            <p role="alert" className="auth-error">
              {error || sessionError}
            </p>
          )}
          <button className="button" disabled={busy} type="submit">
            {busy ? 'Un instant…' : mode === 'login' ? 'Me connecter' : 'Créer mon compte'}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="login-reassurance">
          <BookOpen size={18} />
          <p>
            Vos cours, vos favoris, vos progrès.
            <br />
            <strong>Tout votre apprentissage, au même endroit.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

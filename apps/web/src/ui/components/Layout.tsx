import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, Search, X, GraduationCap, ShieldCheck } from 'lucide-react';
import { ExploreMenu } from './ExploreMenu';
import { useAuth } from '../auth-context';
import { useLearning } from '../context';
export function Layout() {
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { error } = useLearning();
  const { session, logout } = useAuth();
  const administrator = session && ['SUPER_ADMIN', 'REGULATOR'].includes(session.learner.role);
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => {
    setMenu(false);
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
      }
      target?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.search, location.hash]);
  return (
    <>
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <div className="announcement">
        Un savoir accessible. Un avenir à construire.{' '}
        <span>
          Une initiative du Ministère de l’Éducation nationale <ArrowRight size={13} />
        </span>
      </div>
      <header className="header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="EduTube accueil">
            <img src="/img/logo-dptic-edutube.svg" alt="EduTube" />
          </Link>
          <nav aria-label="Navigation principale" className={menu ? 'nav open' : 'nav'}>
            <ExploreMenu />
            {(session?.learner.role === 'SUPER_ADMIN' || session?.learner.role === 'REGULATOR') && (
              <NavLink to="/administration">Administration</NavLink>
            )}
            {(session?.learner.role === 'TEACHER' || session?.learner.role === 'ADMIN') && (
              <NavLink to="/enseigner">Enseigner</NavLink>
            )}
            <NavLink onClick={() => setMenu(false)} to="/catalogue">
              Catalogue
            </NavLink>
            <NavLink onClick={() => setMenu(false)} to="/parcours">
              Parcours
            </NavLink>
            <NavLink onClick={() => setMenu(false)} to="/a-propos">
              Notre mission
            </NavLink>
          </nav>
          <form
            className="header-search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/catalogue?q=${encodeURIComponent(query)}`);
            }}
          >
            <Search size={17} />
            <input
              aria-label="Rechercher un cours"
              placeholder="Qu’avez-vous envie d’apprendre ?"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
          <div className="session-actions">
            <Link className="space-link" to={administrator ? '/administration' : '/mon-espace'}>
              {administrator ? <ShieldCheck size={18} /> : <GraduationCap size={18} />}
              <span>{administrator ? 'Console admin' : 'Mon espace'}</span>
            </Link>
            {session && (
              <Link className="text-link" to="/profil">
                Mon profil
              </Link>
            )}
            {session && (
              <button
                onClick={() => {
                  setLogoutError('');
                  void logout().catch((failure: unknown) =>
                    setLogoutError(
                      failure instanceof Error
                        ? failure.message
                        : 'Déconnexion impossible. Réessayez.',
                    ),
                  );
                }}
              >
                Déconnexion
              </button>
            )}
          </div>
          <button
            className="menu-button"
            aria-label={menu ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main" key={location.pathname}>
        {logoutError && (
          <p role="alert" className="notice">
            {logoutError}
          </p>
        )}
        {error && (
          <div role="alert" className="notice">
            {error}
          </div>
        )}
        <Outlet />
      </main>
      <footer>
        <div className="footer-top">
          <div>
            <Link to="/" className="footer-brand">
              Edu<span>Tube</span>
              <span className="brand-dot">.</span>
            </Link>
            <p>
              Le savoir se partage.
              <br />
              L’avenir se construit ensemble.
            </p>
          </div>
          <div>
            <h3>Apprendre</h3>
            <Link to="/catalogue">Tous les cours</Link>
            <Link to="/parcours">Les parcours</Link>
            <Link to="/mon-espace">Mon apprentissage</Link>
            {session && <Link to="/profil">Mon profil</Link>}
          </div>
          <div>
            <h3>EduTube</h3>
            <Link to="/a-propos">Notre mission</Link>
            <Link to="/a-propos#accessibilite">Accessibilité</Link>
            <Link to="/a-propos#confidentialite">Confidentialité</Link>
          </div>
          <div className="footer-note">
            <span className="eyebrow">POUR TOUS, PARTOUT</span>
            <p>
              Une plateforme pédagogique
              <br />
              pensée pour le Sénégal.
            </p>
            <span className="country-stripe" />
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} EduTube · Ministère de l’Éducation nationale</span>
          <span>Version de démonstration · données fictives</span>
        </div>
      </footer>
    </>
  );
}

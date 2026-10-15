import { useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, LayoutGrid, List, X, Bookmark } from 'lucide-react';
import { useLearning } from '../context';
import { useStudy } from '../study-context';
import { filterCourses } from '../../application/catalog';
import { CourseGrid, EmptyState } from '../components/primitives';
import { CourseRow } from '../components/learning-ui';
export function Catalog() {
  const { courses, loading } = useLearning();
  const { state } = useStudy();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const subject = params.get('matiere') ?? '';
  const level = params.get('niveau') ?? '';
  const sort = params.get('tri') ?? 'popular';
  const list = params.get('vue') === 'liste';
  const favorites = params.get('favoris') === 'oui';
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const results = filterCourses(courses, { query, subject, level, sort }).filter(
    (course) => !favorites || state.favorites.includes(course.id),
  );
  return (
    <>
      <section className="catalog-intro container">
        <div className="catalog-intro-copy">
          <span className="eyebrow">VOTRE PROCHAINE DÉCOUVERTE</span>
          <h1>{subject ? `${subject}, à votre rythme.` : 'Un sujet vous intrigue ? Entrez.'}</h1>
          <p>
            {subject
              ? 'Des notions à comprendre, des méthodes à pratiquer.'
              : 'Cherchez une notion, choisissez un niveau, trouvez votre cours.'}
          </p>
          <div className="catalog-search">
            <Search size={20} />
            <input
              aria-label="Rechercher dans le catalogue"
              placeholder="Thalès, fractions, expression écrite…"
              value={query}
              onChange={(event) => update('q', event.target.value)}
            />
            {query && (
              <button aria-label="Effacer la recherche" onClick={() => update('q', '')}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="catalog-feature">
          <span>UN COURS, PLUSIEURS FAÇONS D’APPRENDRE</span>
          <b>
            Lire.
            <br />
            Noter.
            <br />
            <em>S’entraîner.</em>
          </b>
          <small>Des fiches et des quiz, dès maintenant.</small>
        </div>
      </section>
      <div className="container subject-tabs" aria-label="Matières">
        {['', ...new Set(courses.map((course) => course.subject))].map((study) => (
          <button
            key={study}
            className={subject === study ? 'active' : ''}
            aria-pressed={subject === study}
            onClick={() => update('matiere', study)}
          >
            {study || 'Tout découvrir'}
          </button>
        ))}
      </div>
      <section className="container catalog-body">
        <aside className="filters">
          <h2>
            <SlidersHorizontal size={18} />
            Trouver le bon cours
          </h2>
          <fieldset>
            <legend>Niveau scolaire</legend>
            {['', 'Primaire', 'Collège', 'Lycée'].map((study) => (
              <label key={study}>
                <input
                  type="radio"
                  name="level"
                  checked={level === study}
                  onChange={() => update('niveau', study)}
                />
                {study || 'Tous les niveaux'}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Ma sélection</legend>
            <label>
              <input
                type="checkbox"
                checked={favorites}
                onChange={() => update('favoris', favorites ? '' : 'oui')}
              />
              Mes favoris uniquement
            </label>
          </fieldset>
          <button className="text-link reset" onClick={() => setParams({})}>
            Réinitialiser
          </button>
          <div className="catalog-advice">
            <Bookmark size={22} />
            <h3>Pas le temps maintenant ?</h3>
            <p>Enregistrez un cours et retrouvez-le dans votre espace.</p>
            <Link className="text-link" to="/mon-espace?onglet=favoris">
              Voir mes favoris →
            </Link>
          </div>
        </aside>
        <div>
          <div className="results-header">
            <p role="status">
              <strong>{results.length}</strong> cours {level && `· ${level}`}
            </p>
            <div className="results-controls">
              <label>
                Trier
                <select value={sort} onChange={(event) => update('tri', event.target.value)}>
                  <option value="popular">Les plus suivis</option>
                  <option value="rating">Les mieux notés</option>
                </select>
              </label>
              <div className="view-switch">
                <button
                  aria-label="Vue grille"
                  aria-pressed={!list}
                  onClick={() => update('vue', '')}
                >
                  <LayoutGrid size={17} />
                </button>
                <button
                  aria-label="Vue liste"
                  aria-pressed={list}
                  onClick={() => update('vue', 'liste')}
                >
                  <List size={17} />
                </button>
              </div>
            </div>
          </div>
          {(query || level || favorites) && (
            <div className="active-filters">
              {query && (
                <button onClick={() => update('q', '')}>
                  « {query} »<X size={12} />
                </button>
              )}
              {level && (
                <button onClick={() => update('niveau', '')}>
                  {level}
                  <X size={12} />
                </button>
              )}
              {favorites && (
                <button onClick={() => update('favoris', '')}>
                  Favoris
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          {loading ? (
            <p role="status">Chargement…</p>
          ) : results.length ? (
            list ? (
              <div className="catalog-list">
                {results.map((course) => (
                  <CourseRow key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <CourseGrid courses={results} />
            )
          ) : (
            <EmptyState
              title="Aucun cours pour cette sélection"
              description="Retirez un filtre ou essayez un autre mot-clé."
            >
              <button className="button" onClick={() => setParams({})}>
                Tout découvrir
              </button>
            </EmptyState>
          )}
        </div>
      </section>
      <section className="container catalog-bottom">
        <div>
          <span className="eyebrow">BESOIN D’UNE DIRECTION ?</span>
          <h2>Un parcours met les cours dans le bon ordre.</h2>
        </div>
        <Link className="button" to="/parcours">
          Choisir mon objectif →
        </Link>
      </section>
    </>
  );
}

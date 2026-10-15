import { AdminProfilePanel } from '../components/administration/Profile';
import { AdminCourseList } from '../components/administration/CourseList';
import './administration.css';
import {
  AdminOverviewPanel,
  actionLabels,
  type AdminSection,
} from '../components/administration/Overview';
import { AdminDrawer } from '../components/administration/Drawer';
import { AuditState } from '../components/AuditState';
import type { TeachingCourse } from '@edutube/contracts/teaching';
import type { VideoView } from '@edutube/contracts/videos';
import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import {
  ShieldCheck,
  Users,
  BookOpen,
  History,
  Search,
  ArrowRight,
  Plus,
  X,
  LayoutDashboard,
  PlaySquare,
  ArrowUpRight,
  ExternalLink,
  LogOut,
  RefreshCw,
  Menu,
  ChevronRight,
  UserRound,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type {
  AdminAccount,
  AdminCourse,
  AdminJournal,
  AdminOverview,
} from '@edutube/contracts/administration';
import { administration } from '../../adapters/http/administration';
import { useAuth } from '../auth-context';
const CourseVideoPlayer = lazy(() => import('../components/VideoPlayer'));
const roleLabels = {
  LEARNER: 'Apprenant',
  TEACHER: 'Enseignant',
  ADMIN: 'Enseignant référent',
  REGULATOR: 'Régulateur',
  SUPER_ADMIN: 'Super-admin',
} satisfies Record<AdminAccount['role'], string>;
type Intervention =
  | { kind: 'account'; account: AdminAccount }
  | { kind: 'course'; course: AdminCourse; action: 'WITHDRAW' | 'DELETE' | 'RESTORE' }
  | { kind: 'invite' };
export function AdministrationPage() {
  const { session, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewBusy, setOverviewBusy] = useState(true);
  const role = session?.learner.role;
  const allowed = role === 'SUPER_ADMIN' || role === 'REGULATOR';
  const [review, setReview] = useState<TeachingCourse | null>(null);
  const [reviewVideo, setReviewVideo] = useState<VideoView | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const sectionPaths: Record<AdminSection, string> = {
    overview: '/administration',
    accounts: '/administration/comptes',
    courses: '/administration/contenus',
    journal: '/administration/journal',
    profile: '/administration/profil',
  };
  const tab =
    (Object.keys(sectionPaths) as AdminSection[]).find(
      (section) => sectionPaths[section] === location.pathname,
    ) ?? 'overview';
  const [query, setQuery] = useState('');
  const [params, setParams] = useSearchParams();
  const filter = params.get('filtre') ?? 'all';
  const setFilter = (value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'all') {
        next.delete('filtre');
      } else {
        next.set('filtre', value);
      }
      return next;
    });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [journal, setJournal] = useState<AdminJournal['items']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!allowed || tab === 'overview' || tab === 'profile') {
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const load = async () => {
      if (tab === 'accounts') {
        const result = await administration.accounts(search, page, filter);
        if (active) {
          setAccounts(result.items);
          setTotal(result.total);
        }
      } else if (tab === 'courses') {
        const result = await administration.courses(search, page, filter);
        if (active) {
          setCourses(result.items);
          setTotal(result.total);
        }
      } else {
        const result = await administration.journal(search, page);
        if (active) {
          setJournal(result.items);
          setTotal(result.total);
        }
      }
    };
    void load()
      .catch((failure: unknown) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : 'Chargement impossible.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [allowed, tab, search, page, revision, filter]);
  useEffect(() => {
    if (!allowed) {
      return;
    }
    let active = true;
    setOverviewBusy(true);
    void administration
      .overview()
      .then((data) => {
        if (active) {
          setOverview(data);
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : 'Tableau de bord indisponible.');
        }
      })
      .finally(() => {
        if (active) {
          setOverviewBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [allowed, revision]);
  const navigateSection = (section: AdminSection, selectedFilter = 'all') => {
    navigate(
      sectionPaths[section] +
        (selectedFilter === 'all' ? '' : `?filtre=${encodeURIComponent(selectedFilter)}`),
    );
    setPage(1);
    setSearch('');
    setQuery('');
    setIntervention(null);
    setNotice('');
    setReview(null);
    setReviewVideo(null);
    setSidebarOpen(false);
  };
  useEffect(() => {
    setSidebarOpen(false);
    setIntervention(null);
    setReview(null);
    setReviewVideo(null);
    setQuery('');
    setSearch('');
    setPage(1);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  if (!allowed) {
    return (
      <section className="container section">
        <h1>Un espace réservé à l’administration</h1>
        <p>Votre compte ne dispose pas des droits nécessaires.</p>
        <Link to="/mon-espace">Revenir à mon espace</Link>
      </section>
    );
  }
  const inspect = async (course: AdminCourse) => {
    setReviewBusy(true);
    setError('');
    setReviewVideo(null);
    try {
      setReview(await administration.review(course.id));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Vérification impossible.');
    } finally {
      setReviewBusy(false);
    }
  };
  const inspectVideo = async (lessonId: string) => {
    if (!review) {
      return;
    }
    setReviewBusy(true);
    setError('');
    setReviewVideo(null);
    try {
      const video = await administration.video(review.id, lessonId);
      setReviewVideo(video);
      if (!video || video.status !== 'READY') {
        setNotice('Cette vidéo n’est pas encore prête pour la lecture.');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Lecture impossible.');
    } finally {
      setReviewBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!intervention) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const reason = String(form.get('reason'));
    setBusy(true);
    setError('');
    try {
      if (intervention.kind === 'invite') {
        await administration.create({
          email: String(form.get('email')),
          displayName: String(form.get('displayName')),
          role: String(form.get('role')) as AdminAccount['role'],
          reason,
        });
      } else if (intervention.kind === 'account') {
        await administration.change(intervention.account.id, {
          role: String(form.get('role')) as AdminAccount['role'],
          suspended: form.get('suspended') === 'on',
          expectedRevision: intervention.account.revision,
          reason,
        });
      } else {
        await administration.moderate(intervention.course.id, {
          action: intervention.action,
          reason,
          expectedRevision: intervention.course.revision,
        });
      }
      setNotice(
        intervention.kind === 'invite'
          ? 'Compte créé. Une invitation pour choisir son mot de passe a été envoyée.'
          : 'Modification enregistrée dans le journal.',
      );
      setIntervention(null);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`admin-page ops-shell studio-${tab} ${sidebarOpen ? 'ops-menu-open' : ''}`}>
      <a className="skip-link" href="#admin-main">
        Aller au contenu
      </a>
      {sidebarOpen && (
        <button
          className="ops-menu-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className="ops-sidebar">
        <Link className="ops-brand" to="/administration">
          <span className="ops-logo">
            <PlaySquare />
          </span>
          <span>
            EduTube<span className="ops-brand-dot">.</span>
            <small>ADMINISTRATION</small>
          </span>
        </Link>
        <div className="ops-workspace-label">
          <span className="ops-status-dot" />
          Espace de gestion
        </div>
        <p className="ops-nav-label">PRINCIPAL</p>
        <nav aria-label="Administration">
          {[
            { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
            { id: 'courses', label: 'Contenus', icon: BookOpen },
            ...(role === 'SUPER_ADMIN'
              ? [{ id: 'accounts', label: 'Comptes & accès', icon: Users }]
              : []),
            { id: 'journal', label: 'Journal des actions', icon: History },
            { id: 'profile', label: 'Mon compte', icon: UserRound },
          ].map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              aria-current={tab === item.id ? 'page' : undefined}
              disabled={busy}
              onClick={() => navigateSection(item.id as AdminSection)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === 'courses' && overview && <small>{overview.courses.total}</small>}
              {item.id === 'accounts' && overview?.accounts && (
                <small>{overview.accounts.total}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="ops-sidebar-bottom">
          <div className="ops-audit-note">
            <ShieldCheck size={21} />
            <strong>Chaque action compte.</strong>
            <p>Les interventions sont enregistrées et consultables dans le journal.</p>
            <button onClick={() => navigateSection('journal')}>
              Voir le journal
              <ArrowRight size={14} />
            </button>
          </div>
          <Link className="ops-return" to="/catalogue">
            <ExternalLink size={17} />
            Retour à la plateforme
            <ArrowUpRight />
          </Link>
          <div className="ops-user">
            <span className="ops-avatar">
              {session?.learner.displayName
                .split(' ')
                .map((word) => word[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <strong>{session?.learner.displayName}</strong>
              <small>{role === 'SUPER_ADMIN' ? 'Super-administrateur' : 'Régulateur'}</small>
            </div>
            <button
              aria-label="Se déconnecter"
              onClick={() =>
                void logout().catch((failure: unknown) =>
                  setError(failure instanceof Error ? failure.message : 'Déconnexion impossible.'),
                )
              }
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="ops-main">
        <header className="ops-topbar">
          <div>
            <button
              className="ops-menu-toggle"
              aria-label="Ouvrir la navigation"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={20} />
            </button>
            <span>Administration</span>
            <ChevronRight size={13} />
            <strong>
              {tab === 'profile'
                ? 'Mon compte'
                : tab === 'overview'
                  ? 'Vue d’ensemble'
                  : tab === 'accounts'
                    ? 'Comptes & accès'
                    : tab === 'courses'
                      ? 'Contenus'
                      : 'Journal des actions'}
            </strong>
          </div>
          <div>
            <span className="ops-topbar-role">
              <ShieldCheck size={14} />
              {role === 'SUPER_ADMIN' ? 'Super-admin' : 'Régulateur'}
            </span>
            <Link to="/administration/profil" className="ops-profile" aria-label="Mon profil">
              {session?.learner.displayName
                .split(' ')
                .map((word) => word[0])
                .slice(0, 2)
                .join('')}
            </Link>
          </div>
        </header>
        <main id="admin-main" className="admin-content ops-content">
          <div className="ops-page-heading">
            <div>
              <div className="ops-page-kicker">
                ESPACE ADMINISTRATEUR <span> / </span> EDUTUBE
              </div>
              <h1>
                {tab === 'profile'
                  ? 'Mon compte'
                  : tab === 'overview'
                    ? 'Vue d’ensemble'
                    : tab === 'accounts'
                      ? 'Comptes & accès'
                      : tab === 'courses'
                        ? 'Gestion des contenus'
                        : 'Journal des actions'}
              </h1>
              <p>
                {tab === 'profile'
                  ? 'Gérez vos informations personnelles et la sécurité de votre accès.'
                  : tab === 'overview'
                    ? `Bonjour ${session?.learner.displayName.split(' ')[0]}, voici ce qui se passe sur votre plateforme.`
                    : tab === 'accounts'
                      ? 'Gérez les personnes, les rôles et les autorisations d’accès.'
                      : tab === 'courses'
                        ? 'Examinez les cours et pilotez leur disponibilité.'
                        : 'Suivez les décisions et retrouvez chaque intervention.'}
              </p>
            </div>
            <div className="ops-page-actions">
              {tab !== 'profile' && (
                <button
                  className="ops-refresh"
                  disabled={overviewBusy || busy}
                  onClick={() => {
                    setRevision((value) => value + 1);
                    setError('');
                  }}
                >
                  <RefreshCw size={15} className={overviewBusy ? 'ops-spinning' : ''} />
                  Actualiser
                </button>
              )}
              {role === 'SUPER_ADMIN' && tab !== 'profile' && (
                <button
                  className="button"
                  onClick={() => {
                    setIntervention({ kind: 'invite' });
                    setError('');
                  }}
                >
                  <Plus size={16} />
                  Inviter un compte
                </button>
              )}
            </div>
          </div>
          {tab === 'profile' && <AdminProfilePanel />}
          {tab === 'courses' && overview && (
            <div className="studio-collection">
              <div>
                <span className="studio-collection-label">CATALOGUE · MODÉRATION</span>
                <h2>La bibliothèque EduTube.</h2>
                <p>Suivez les publications et retrouvez les cours à vérifier.</p>
              </div>
              <div className="studio-collection-count">
                <strong>{overview.courses.total.toString().padStart(2, '0')}</strong>
                <span>
                  cours dans
                  <br />
                  la collection
                </span>
              </div>
              <BookOpen className="studio-collection-decoration" size={150} />
            </div>
          )}
          {tab === 'courses' && overview && (
            <div className="studio-status-tabs" aria-label="État des cours">
              {[
                { value: 'all', label: 'Tous les cours', count: overview.courses.total },
                { value: 'PUBLISHED', label: 'En ligne', count: overview.courses.published },
                { value: 'DRAFT', label: 'Brouillons', count: overview.courses.draft },
                {
                  value: 'moderated',
                  label: 'Modérés',
                  count: overview.courses.withdrawn + overview.courses.deleted,
                },
              ].map((item) => (
                <button
                  key={item.value}
                  aria-pressed={filter === item.value}
                  className={filter === item.value ? 'active' : ''}
                  onClick={() => {
                    setFilter(item.value);
                    setPage(1);
                  }}
                >
                  {item.label}
                  <span>{item.count}</span>
                </button>
              ))}
            </div>
          )}
          {tab === 'overview' && overview && (
            <AdminOverviewPanel
              data={overview}
              onNavigate={navigateSection}
              onInvite={() => {
                setIntervention({ kind: 'invite' });
                setError('');
              }}
            />
          )}
          {tab === 'overview' && overviewBusy && !overview && (
            <p role="status" className="ops-loading">
              Chargement du tableau de bord…
            </p>
          )}
          {tab !== 'overview' && tab !== 'profile' && (
            <>
              <form
                className="admin-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearch(query);
                  setPage(1);
                }}
              >
                <Search size={19} />
                <input
                  aria-label="Rechercher dans l’administration"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    tab === 'accounts'
                      ? 'Un nom, une adresse e-mail…'
                      : tab === 'courses'
                        ? 'Le titre d’un cours…'
                        : 'Un auteur, une action, un identifiant…'
                  }
                />
                {tab !== 'journal' && (
                  <select
                    aria-label={tab === 'accounts' ? 'Filtrer les comptes' : 'Filtrer les contenus'}
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value);
                      setPage(1);
                    }}
                  >
                    {(tab === 'accounts'
                      ? [
                          ['all', 'Tous les comptes'],
                          ['active', 'Comptes actifs'],
                          ['suspended', 'Comptes suspendus'],
                          ['unverified', 'Adresses à vérifier'],
                          ['LEARNER', 'Apprenants'],
                          ['TEACHER', 'Enseignants'],
                          ['REGULATOR', 'Régulateurs'],
                          ['SUPER_ADMIN', 'Super-admins'],
                        ]
                      : [
                          ['all', 'Tous les contenus'],
                          ['PUBLISHED', 'Cours publiés'],
                          ['DRAFT', 'Brouillons'],
                          ['ARCHIVED', 'Cours archivés'],
                          ['moderated', 'Contenus modérés'],
                          ['video_ready', 'Vidéos disponibles'],
                          ['video_processing', 'Vidéos en préparation'],
                          ['video_failed', 'Vidéos en échec'],
                        ]
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
                <button className="button" type="submit">
                  Rechercher
                </button>
              </form>
            </>
          )}
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          {review && (
            <AdminDrawer
              label="Examen du cours"
              onClose={() => {
                setReview(null);
                setReviewVideo(null);
              }}
            >
              <section className="admin-review">
                {error && (
                  <p role="alert" className="auth-error">
                    {error}
                  </p>
                )}
                {notice && (
                  <p role="status" className="notice">
                    {notice}
                  </p>
                )}
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">VÉRIFICATION DU CONTENU</span>
                    <h3>{review.title}</h3>
                  </div>
                  <button
                    aria-label="Fermer la vérification"
                    onClick={() => {
                      setReview(null);
                      setReviewVideo(null);
                    }}
                  >
                    <X />
                  </button>
                </div>
                <p>{review.description}</p>
                <h4>Objectifs</h4>
                <ul>
                  {review.outcomes.map((outcome) => (
                    <li key={outcome}>{outcome}</li>
                  ))}
                </ul>
                {review.lessons.map((lesson, position) => (
                  <details key={lesson.id}>
                    <summary>
                      {position + 1}. {lesson.title} ·{' '}
                      {lesson.kind === 'VIDEO' ? 'Vidéo' : 'Lecture'}
                    </summary>
                    {lesson.blocks.map((block, rank) => (
                      <div key={`${lesson.id}-${rank}`}>
                        {block.type === 'EXAMPLE' && <h4>{block.title}</h4>}
                        <p>{block.text}</p>
                      </div>
                    ))}
                    {lesson.kind === 'VIDEO' && (
                      <button
                        className="button"
                        disabled={reviewBusy}
                        onClick={() => void inspectVideo(lesson.id)}
                      >
                        Examiner la vidéo
                      </button>
                    )}
                  </details>
                ))}
                {reviewVideo?.playbackUrl && (
                  <Suspense fallback={<p>Chargement du lecteur…</p>}>
                    <CourseVideoPlayer
                      key={reviewVideo.id}
                      source={reviewVideo.playbackUrl}
                      poster={reviewVideo.posterUrl}
                      title={reviewVideo.fileName}
                    />
                  </Suspense>
                )}
                {review.quiz && (
                  <details>
                    <summary>Examen · Seuil de réussite : {review.quiz.passingScore}%</summary>
                    {review.quiz.questions.map((question) => (
                      <div key={question.id}>
                        <h4>{question.prompt}</h4>
                        <ul>
                          {question.options.map((option) => (
                            <li key={option.id}>
                              {option.text}
                              {option.id === question.correctOptionId ? ' ✓' : ''}
                            </li>
                          ))}
                        </ul>
                        <p>{question.explanation}</p>
                      </div>
                    ))}
                  </details>
                )}
              </section>
            </AdminDrawer>
          )}
          {intervention && (
            <AdminDrawer
              label="Intervention administrative"
              busy={busy}
              onClose={() => setIntervention(null)}
            >
              <div className="admin-intervention">
                {error && (
                  <p role="alert" className="auth-error">
                    {error}
                  </p>
                )}
                <div className="section-heading">
                  <h3>
                    {intervention.kind === 'invite'
                      ? 'Inviter une personne'
                      : intervention.kind === 'account'
                        ? `Gérer ${intervention.account.displayName}`
                        : intervention.action === 'RESTORE'
                          ? 'Restaurer ce cours'
                          : intervention.action === 'DELETE'
                            ? 'Supprimer ce cours'
                            : 'Retirer ce cours'}
                  </h3>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label="Fermer l’intervention"
                    onClick={() => setIntervention(null)}
                  >
                    <X />
                  </button>
                </div>
                <form
                  key={
                    intervention.kind === 'account'
                      ? intervention.account.id
                      : intervention.kind === 'course'
                        ? `${intervention.course.id}-${intervention.action}`
                        : 'invite'
                  }
                  onSubmit={submit}
                >
                  {intervention.kind === 'course' ? (
                    <p>
                      <strong>{intervention.course.title}</strong>
                      <br />
                      {intervention.action === 'RESTORE'
                        ? 'Le cours redeviendra un brouillon, à vérifier avant publication.'
                        : 'Le cours et ses vidéos ne seront plus accessibles aux apprenants. Les données d’apprentissage seront conservées.'}
                    </p>
                  ) : (
                    <>
                      {intervention.kind === 'invite' && (
                        <>
                          <label>
                            Nom complet
                            <input name="displayName" required minLength={2} maxLength={100} />
                          </label>
                          <label>
                            Adresse e-mail
                            <input
                              type="email"
                              name="email"
                              autoComplete="off"
                              required
                              maxLength={254}
                            />
                          </label>
                          <p>
                            La personne recevra un lien pour choisir son mot de passe. Aucun mot de
                            passe n’est partagé.
                          </p>
                        </>
                      )}
                      <label>
                        Rôle
                        <select
                          name="role"
                          defaultValue={
                            intervention.kind === 'account'
                              ? intervention.account.role
                              : 'REGULATOR'
                          }
                        >
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="note-status">
                        Super-admin : comptes et modération. Régulateur : contenus uniquement.
                        Enseignant : ses propres cours.
                      </p>
                      {intervention.kind === 'account' && (
                        <label className="admin-check">
                          <input
                            type="checkbox"
                            name="suspended"
                            defaultChecked={intervention.account.suspended}
                          />
                          Suspendre l’accès à la plateforme
                        </label>
                      )}
                    </>
                  )}
                  <label>
                    Motif de l’intervention
                    <textarea
                      name="reason"
                      required
                      minLength={10}
                      maxLength={1000}
                      placeholder="Expliquez la raison de cette décision…"
                    />
                  </label>
                  <p className="note-status">
                    Votre nom, la date, le motif et les changements seront conservés dans le
                    journal.
                  </p>
                  <button className="button" type="submit" disabled={busy}>
                    {busy
                      ? 'Enregistrement…'
                      : intervention.kind === 'invite'
                        ? 'Envoyer l’invitation'
                        : 'Confirmer l’intervention'}
                  </button>
                </form>
              </div>
            </AdminDrawer>
          )}
          {tab !== 'overview' &&
            tab !== 'profile' &&
            (loading ? (
              <p role="status">Chargement…</p>
            ) : (
              <>
                <p className="note-status">
                  {total} résultat{total > 1 ? 's' : ''}
                </p>
                {tab === 'accounts' && (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Personne</th>
                          <th>Rôle</th>
                          <th>Accès</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((account) => (
                          <tr key={account.id}>
                            <td>
                              <span className="ops-person-avatar" aria-hidden="true">
                                {account.displayName
                                  .split(' ')
                                  .map((word) => word[0])
                                  .slice(0, 2)
                                  .join('')}
                              </span>
                              <strong>{account.displayName}</strong>
                              <small>{account.email}</small>
                              <small>
                                {account.verified ? 'Adresse vérifiée' : 'Adresse à vérifier'}
                              </small>
                            </td>
                            <td>{roleLabels[account.role]}</td>
                            <td>
                              <span className={`admin-badge ${account.suspended ? 'warn' : ''}`}>
                                {account.suspended ? 'Suspendu' : 'Actif'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="text-link"
                                disabled={account.id === session?.learner.id}
                                onClick={() => {
                                  setIntervention({ kind: 'account', account });
                                  setError('');
                                }}
                              >
                                {account.id === session?.learner.id ? 'Votre compte' : 'Gérer'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {tab === 'courses' && (
                  <AdminCourseList
                    courses={courses}
                    busy={reviewBusy}
                    onInspect={(course) => void inspect(course)}
                    onModerate={(course, action) =>
                      setIntervention({ kind: 'course', course, action })
                    }
                  />
                )}
                {tab === 'journal' && (
                  <div className="admin-journal">
                    {journal.map((entry) => (
                      <article key={entry.id}>
                        <History size={19} />
                        <div>
                          <div className="section-heading">
                            <strong>{actionLabels[entry.action] ?? entry.action}</strong>
                            <time dateTime={entry.createdAt}>
                              {new Date(entry.createdAt).toLocaleString('fr-FR')}
                            </time>
                          </div>
                          <p>{entry.actor}</p>
                          <p>{entry.reason}</p>
                          <small>
                            Cible : {entry.target} · Demande : {entry.requestId}
                          </small>
                          {(entry.before || entry.after) && (
                            <details>
                              <summary>Voir les changements</summary>
                              <div className="admin-changes">
                                <div>
                                  <h4>Avant</h4>
                                  <AuditState value={entry.before} />
                                </div>
                                <div>
                                  <h4>Après</h4>
                                  <AuditState value={entry.after} />
                                </div>
                              </div>
                            </details>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {total === 0 && <p>Aucun résultat pour cette recherche.</p>}
                <div className="admin-pagination">
                  <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                    Précédent
                  </button>
                  <span>
                    Page {page} sur {Math.max(1, Math.ceil(total / 25))}
                  </span>
                  <button
                    disabled={page * 25 >= total}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Suivant
                  </button>
                </div>
              </>
            ))}
          <div className="ops-footer">
            <span>EduTube · Console d’administration</span>
            <span>
              {overview
                ? `Données actualisées à ${new Date(overview.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Données du serveur'}{' '}
              · Toutes les interventions sont tracées
            </span>
          </div>
        </main>
      </div>
    </section>
  );
}

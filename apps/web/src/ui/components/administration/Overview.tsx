import {
  ArrowRight,
  Users,
  BookOpen,
  PlaySquare,
  GraduationCap,
  ShieldCheck,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  History,
} from 'lucide-react';
import type { AdminOverview } from '@edutube/contracts/administration';
export type AdminSection = 'overview' | 'accounts' | 'courses' | 'journal' | 'profile';
export const actionLabels: Record<string, string> = {
  OVERVIEW_READ: 'Tableau de bord consulté',
  ACTION_REJECTED: 'Intervention refusée',
  ACCOUNTS_READ: 'Comptes consultés',
  COURSES_READ: 'Contenus consultés',
  JOURNAL_READ: 'Journal consulté',
  ACCOUNT_CREATED: 'Compte invité',
  ACCOUNT_CHANGED: 'Compte modifié',
  COURSE_WITHDRAW: 'Cours retiré',
  COURSE_DELETE: 'Cours supprimé',
  COURSE_RESTORE: 'Cours restauré',
  BOOTSTRAP: 'Initialisation des droits',
  COURSE_REVIEWED: 'Cours examiné',
  MEDIA_REVIEWED: 'Média examiné',
  OWNER_ASSIGNED: 'Responsable attribué',
};
const numberFormat = new Intl.NumberFormat('fr-FR');
export function AdminOverviewPanel({
  data,
  onNavigate,
  onInvite,
}: {
  data: AdminOverview;
  onNavigate: (section: AdminSection, filter?: string) => void;
  onInvite: () => void;
}) {
  const maximum = Math.max(2, ...data.activity.map((day) => day.changes + day.reviews));
  const distribution = [
    { label: 'Publiés', value: data.courses.published, color: '#058c83' },
    { label: 'Brouillons', value: data.courses.draft, color: '#edb447' },
    { label: 'Archivés', value: data.courses.archived, color: '#bcc8d2' },
  ];
  const priority = [
    ...(data.accounts
      ? [
          {
            label: 'Adresses à vérifier',
            value: data.accounts.unverified,
            description: 'Comptes en attente de vérification',
            filter: 'unverified',
            section: 'accounts' as const,
          },
        ]
      : []),
    {
      label: 'Vidéos en échec',
      value: data.videos.failed,
      description: 'Préparation vidéo à examiner',
      filter: 'video_failed',
      section: 'courses' as const,
    },
    {
      label: 'Contenus retirés',
      value: data.courses.withdrawn + data.courses.deleted,
      description: 'Cours masqués par la modération',
      filter: 'moderated',
      section: 'courses' as const,
    },
  ];
  return (
    <div className="ops-overview">
      <div className="ops-metrics">
        {[
          ...(data.accounts
            ? [
                {
                  label: 'Comptes inscrits',
                  value: data.accounts.total,
                  detail: `${data.accounts.active} actifs · ${data.accounts.suspended} suspendus`,
                  icon: Users,
                  color: 'blue',
                  section: 'accounts' as const,
                },
              ]
            : []),
          {
            label: 'Cours au catalogue',
            value: data.courses.total,
            detail: `${data.courses.published} publiés · ${data.courses.draft} brouillon${data.courses.draft === 1 ? '' : 's'}`,
            icon: BookOpen,
            color: 'teal',
            section: 'courses' as const,
          },
          {
            label: 'Vidéos disponibles',
            value: data.videos.ready,
            detail: `${data.videos.processing} en préparation · ${data.videos.failed} en échec`,
            icon: PlaySquare,
            color: 'purple',
            filter: 'video_ready',
            section: 'courses' as const,
          },
          {
            label: 'Inscriptions aux cours',
            value: data.learning.enrollments,
            detail: `${data.learning.completions} chapitres terminés`,
            icon: GraduationCap,
            color: 'amber',
            section: 'courses' as const,
          },
        ].map((metric) => (
          <button
            key={metric.label}
            className="ops-metric"
            onClick={() =>
              onNavigate(metric.section, 'filter' in metric ? metric.filter : undefined)
            }
          >
            <span className={`ops-metric-icon ${metric.color}`}>
              <metric.icon size={20} />
            </span>
            <ArrowUpRight size={16} className="ops-metric-arrow" />
            <span className="ops-metric-label">{metric.label}</span>
            <strong>{numberFormat.format(metric.value)}</strong>
            <small>{metric.detail}</small>
          </button>
        ))}
      </div>
      <div className="ops-chart-grid">
        <section className="ops-panel">
          <div className="ops-panel-heading">
            <div>
              <h2>Activité de l’administration</h2>
              <p>Interventions et vérifications de cours</p>
            </div>
            <span className="ops-period">7 derniers jours</span>
          </div>
          <div className="ops-chart-legend">
            <span>
              <i className="teal" />
              Interventions
            </span>
            <span>
              <i className="blue" />
              Cours examinés
            </span>
          </div>
          <div
            className="ops-chart"
            role="img"
            aria-label={data.activity
              .map(
                (day) =>
                  `${day.date} : ${day.changes} interventions, ${day.reviews} cours examinés`,
              )
              .join('. ')}
          >
            <div className="ops-chart-gridlines">
              <span>{maximum}</span>
              <span>{Math.ceil(maximum / 2)}</span>
              <span>0</span>
            </div>
            {data.activity.map((day) => (
              <div key={day.date} className="ops-chart-day">
                <div className="ops-chart-bars">
                  <div
                    title={`${day.changes} interventions`}
                    style={{ height: `${(day.changes / maximum) * 100}%` }}
                  />
                  <div
                    title={`${day.reviews} cours examinés`}
                    style={{ height: `${(day.reviews / maximum) * 100}%` }}
                  />
                </div>
                <span>
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString('fr-FR', {
                    weekday: 'short',
                  })}
                </span>
              </div>
            ))}
          </div>
          <div className="ops-chart-footer">
            <History size={14} />
            Données issues du journal des actions
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel-heading">
            <div>
              <h2>État des contenus</h2>
              <p>Répartition de vos {data.courses.total} cours</p>
            </div>
            <BookOpen size={18} />
          </div>
          <div className="ops-distribution-total">
            <strong>{data.courses.published}</strong>
            <span>
              cours accessibles
              <br />
              aux apprenants
            </span>
          </div>
          <div className="ops-distribution-bar">
            {distribution.map((item) => (
              <span
                key={item.label}
                title={`${item.label} : ${item.value}`}
                style={{
                  width: `${data.courses.total ? (item.value / data.courses.total) * 100 : 0}%`,
                  background: item.color,
                }}
              />
            ))}
          </div>
          <div className="ops-distribution-list">
            {distribution.map((item) => (
              <div key={item.label}>
                <span>
                  <i style={{ background: item.color }} />
                  {item.label}
                </span>
                <strong>{item.value}</strong>
                <small>
                  {data.courses.total
                    ? ((item.value / data.courses.total) * 100).toLocaleString('fr-FR', {
                        maximumFractionDigits: 1,
                      })
                    : 0}
                  %
                </small>
              </div>
            ))}
          </div>
          <button className="ops-panel-link" onClick={() => onNavigate('courses')}>
            Gérer les contenus
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="ops-lower-grid">
        <section className="ops-panel">
          <div className="ops-panel-heading">
            <div>
              <h2>Dernières actions</h2>
              <p>
                {data.accounts
                  ? 'L’activité récente de votre équipe'
                  : 'Vos dernières interventions'}
              </p>
            </div>
            <button className="ops-inline-link" onClick={() => onNavigate('journal')}>
              Tout voir
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="ops-recent-list">
            {data.recent.length === 0 ? (
              <p className="ops-empty">Aucune intervention pour le moment.</p>
            ) : (
              data.recent.map((entry) => (
                <div key={entry.id} className="ops-recent-row">
                  <span
                    className={`ops-event-icon ${entry.action === 'ACTION_REJECTED' ? 'warn' : ''}`}
                  >
                    <ShieldCheck size={17} />
                  </span>
                  <div>
                    <strong>{actionLabels[entry.action] ?? entry.action}</strong>
                    <span>{entry.actor.split(' <')[0]}</span>
                  </div>
                  <time dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                    <small>
                      {new Date(entry.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </small>
                  </time>
                </div>
              ))
            )}
          </div>
        </section>
        <div className="ops-priority-column">
          <section className="ops-panel">
            <div className="ops-panel-heading">
              <h2>Points d’attention</h2>
              <AlertCircle size={18} />
            </div>
            <div className="ops-priorities">
              {priority.map((item) => (
                <button key={item.label} onClick={() => onNavigate(item.section, item.filter)}>
                  <span className={item.value ? 'ops-priority-count' : 'ops-priority-count clear'}>
                    {item.value}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </section>
          <section className="ops-team-card">
            <span className="ops-team-icon">
              <CheckCircle2 size={22} />
            </span>
            <h3>
              {data.accounts
                ? 'Une équipe, des droits clairs.'
                : 'Une modération qui laisse une trace.'}
            </h3>
            <p>
              {data.accounts
                ? `${data.accounts.regulators} régulateur${data.accounts.regulators > 1 ? 's' : ''} et ${data.accounts.teachers} enseignant${data.accounts.teachers > 1 ? 's' : ''} accompagnent la plateforme.`
                : 'Chaque décision est enregistrée avec son auteur et son motif.'}
            </p>
            <button onClick={data.accounts ? onInvite : () => onNavigate('journal')}>
              {data.accounts ? 'Inviter un collaborateur' : 'Consulter mon journal'}
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

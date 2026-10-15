import { FavoriteButton } from './FavoriteButton';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Clock3, Star } from 'lucide-react';
import type { CourseSummary } from '../../domain/course';
export function ButtonLink({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={`button ${secondary ? 'button-secondary' : ''}`} to={to}>
      {children}
    </Link>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  link,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {link && (
        <Link className="text-link" to={link.to}>
          {link.label}
          <ArrowUpRight size={18} />
        </Link>
      )}
    </div>
  );
}
export function CourseArt({
  course,
  large = false,
}: {
  course: Pick<CourseSummary, 'color' | 'illustration' | 'subject'>;
  large?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`course-art art-${course.color} ${large ? 'art-large' : ''}`}
    >
      <span className="art-grid" />
      {course.illustration === 'geometry' ? (
        <svg viewBox="0 0 300 170">
          <circle cx="235" cy="45" r="24" />
          <path d="M65 133 L140 30 L222 133 Z M140 30 V133 M103 81 H181" />
          <text x="60" y="153">
            A
          </text>
          <text x="136" y="22">
            B
          </text>
          <text x="224" y="153">
            C
          </text>
        </svg>
      ) : course.illustration === 'plant' ? (
        <svg viewBox="0 0 300 170">
          <path d="M150 145 V55 M150 110 C70 120 70 45 145 75 M153 91 C228 102 239 30 159 54" />
          <circle cx="237" cy="31" r="17" />
          <path d="M118 145 H180" />
        </svg>
      ) : course.illustration === 'code' ? (
        <div className="code-art">
          <span>&lt; apprendre /&gt;</span>
          <b>if (curiosité) {'{'}</b>
          <i> &nbsp; créer();</i>
          <b>{'}'}</b>
        </div>
      ) : (
        <svg viewBox="0 0 300 170">
          <path d="M58 48 Q105 30 150 52 Q197 30 242 48 V136 Q197 118 150 139 Q105 118 58 136 Z M150 52 V139 M77 66 L129 68 M77 84 L129 86 M174 66 L224 62 M174 84 L224 80" />
          <text x="104" y="115">
            Aa
          </text>
        </svg>
      )}
      <span className="art-label">{course.subject}</span>
    </div>
  );
}
export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <article className="course-card">
      <div className="card-save">
        <FavoriteButton courseId={course.id} compact />
      </div>
      <Link
        to={`/cours/${course.id}`}
        className="card-image"
        aria-label={`Découvrir ${course.title}`}
      >
        <CourseArt course={course} />
        {course.featured && <span className="badge image-badge">Notre sélection</span>}
        <span className="card-arrow">
          <ArrowUpRight size={18} />
        </span>
      </Link>
      <div className="card-body">
        <div className="card-meta">
          <span>{course.subject}</span>
          <span>{course.level}</span>
        </div>
        <h3>
          <Link to={`/cours/${course.id}`}>{course.title}</Link>
        </h3>
        <p className="teacher">Avec {course.teacher}</p>
        <div className="rating">
          <Star size={14} fill="currentColor" />
          <b>{course.rating?.toFixed(1) ?? 'Nouveau'}</b>
          <span>({course.learners.toLocaleString('fr-FR')} apprenants)</span>
        </div>
        <div className="card-bottom">
          <span>
            <Clock3 size={14} />
            {course.duration}
          </span>
          <span>
            <BookOpen size={14} />
            {course.lessonCount} chapitres
          </span>
          <strong>Gratuit</strong>
        </div>
      </div>
    </article>
  );
}
export function CourseGrid({ courses }: { courses: CourseSummary[] }) {
  return (
    <div className="course-grid">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <BookOpen size={36} />
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}

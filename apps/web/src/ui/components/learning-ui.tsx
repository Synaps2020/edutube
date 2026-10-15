import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, Check } from 'lucide-react';
import type { CourseSummary } from '../../domain/course';
import { FavoriteButton } from './FavoriteButton';
import { CourseArt } from './primitives';
export function ProgressBar({
  value,
  label = 'Progression du cours',
}: {
  value: number;
  label?: string;
}) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
export { FavoriteButton } from './FavoriteButton';
export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="interior-intro container">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}
export function CourseRow({
  course,
  index,
  completed = false,
}: {
  course: CourseSummary;
  index?: number;
  completed?: boolean;
}) {
  return (
    <article className="course-row">
      {index !== undefined && (
        <span className="course-row-index">
          {completed ? <Check size={23} /> : String(index + 1).padStart(2, '0')}
        </span>
      )}
      <Link to={`/cours/${course.id}`} className="row-art" aria-label={`Découvrir ${course.title}`}>
        <CourseArt course={course} />
      </Link>
      <div className="row-copy">
        <span className="eyebrow">
          {course.subject} · {course.level}
        </span>
        <h3>
          <Link to={`/cours/${course.id}`}>{course.title}</Link>
        </h3>
        <p>{course.description}</p>
        <span className="row-meta">
          {course.teacher}
          <span>
            <Clock3 size={13} />
            {course.duration}
          </span>
          {course.lessonCount} chapitres
        </span>
      </div>
      <div className="row-actions">
        <FavoriteButton compact courseId={course.id} />
        <Link to={`/cours/${course.id}`} aria-label={`Ouvrir ${course.title}`}>
          <ArrowUpRight size={20} />
        </Link>
      </div>
    </article>
  );
}

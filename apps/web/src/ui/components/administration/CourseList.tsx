import { BookOpen, Clock3, ArrowUpRight, MoreHorizontal } from 'lucide-react';
import type { AdminCourse, Moderation } from '@edutube/contracts/administration';
import { CourseArt } from '../primitives';
export function AdminCourseList({
  courses,
  busy,
  onInspect,
  onModerate,
}: {
  courses: AdminCourse[];
  busy: boolean;
  onInspect: (course: AdminCourse) => void;
  onModerate: (course: AdminCourse, action: Moderation['action']) => void;
}) {
  return (
    <div className="studio-course-list">
      {courses.map((course) => (
        <article className="studio-course" key={course.id}>
          <div className="studio-course-cover">
            <CourseArt
              course={{
                subject: course.subject,
                color: course.palette,
                illustration: course.illustration ?? 'writing',
              }}
            />
          </div>
          <div className="studio-course-info">
            <span className="studio-course-category">
              {course.subject}
              <i />
              {{ PRIMARY: 'Primaire', MIDDLE: 'Collège', SECONDARY: 'Lycée' }[course.schoolLevel]}
            </span>
            <h2>{course.title}</h2>
            <div className="studio-course-meta">
              <span className="studio-owner-inline">{course.owner ?? 'Sans responsable'}</span>
              <span>
                <BookOpen size={13} />
                {course.lessonCount} chapitre{course.lessonCount === 1 ? '' : 's'}
              </span>
              <span>
                <Clock3 size={13} />
                {course.durationMinutes >= 60
                  ? `${Math.floor(course.durationMinutes / 60)} h ${course.durationMinutes % 60 || ''}`
                  : `${course.durationMinutes} min`}
              </span>
              <span>
                {course.learners} inscrit{course.learners === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div className="studio-course-owner">
            <span className="studio-owner-avatar">
              {(course.owner ?? '?')
                .split(' ')
                .map((word) => word[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <strong>{course.owner ?? 'Sans responsable'}</strong>
              <small>
                Mis à jour le{' '}
                {new Date(course.updatedAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                })}
              </small>
            </div>
          </div>
          <span
            className={`studio-status ${course.moderation !== 'CLEAR' ? 'removed' : course.status.toLowerCase()}`}
          >
            <i />
            {course.moderation === 'DELETED'
              ? 'Supprimé'
              : course.moderation === 'WITHDRAWN'
                ? 'Retiré'
                : course.status === 'PUBLISHED'
                  ? 'Publié'
                  : course.status === 'DRAFT'
                    ? 'Brouillon'
                    : 'Archivé'}
          </span>
          <div className="studio-course-actions">
            <button className="studio-examine" disabled={busy} onClick={() => onInspect(course)}>
              Examiner
              <ArrowUpRight size={15} />
            </button>
            <details
              className="studio-menu"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                }
              }}
            >
              <summary aria-label={`Actions pour ${course.title}`}>
                <MoreHorizontal size={20} />
              </summary>
              <div>
                {course.moderation !== 'CLEAR' ? (
                  <button
                    onClick={(event) => {
                      const menu = event.currentTarget.closest('details');
                      menu?.querySelector('summary')?.focus();
                      menu?.removeAttribute('open');
                      onModerate(course, 'RESTORE');
                    }}
                  >
                    Restaurer le cours
                  </button>
                ) : (
                  <button
                    onClick={(event) => {
                      const menu = event.currentTarget.closest('details');
                      menu?.querySelector('summary')?.focus();
                      menu?.removeAttribute('open');
                      onModerate(course, 'WITHDRAW');
                    }}
                  >
                    Retirer du catalogue
                  </button>
                )}
                {course.moderation !== 'DELETED' && (
                  <button
                    className="studio-delete"
                    onClick={(event) => {
                      const menu = event.currentTarget.closest('details');
                      menu?.querySelector('summary')?.focus();
                      menu?.removeAttribute('open');
                      onModerate(course, 'DELETE');
                    }}
                  >
                    Supprimer le cours
                  </button>
                )}
              </div>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}

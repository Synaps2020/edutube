import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { EnrollmentViewDto } from '@edutube/contracts';
import type { Course, CourseSummary, Enrollment, LearningPath } from '../domain/course';
import type { CatalogRepository, LearningAccess } from '../application/ports';
import { enrollmentView, progressView } from '../adapters/http/personal';
import { courseSummaryView } from '../adapters/http/catalog-repository';
interface LearningContext {
  courses: CourseSummary[];
  paths: LearningPath[];
  enrollments: Enrollment[];
  loadCourse(id: string): Promise<Course>;
  loading: boolean;
  error: string;
  busy: string;
  join(id: string): Promise<void>;
  joinPath(id: string): Promise<void>;
  complete(course: Course, lessonId: string): Promise<void>;
}

const Context = createContext<LearningContext | null>(null);
export function LearningProvider({
  catalog,
  learning,
  authenticated,
  children,
}: {
  catalog: CatalogRepository;
  learning: LearningAccess;
  authenticated: boolean;
  children: ReactNode;
}) {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    Promise.all([
      catalog.getCourses(),
      catalog.getPaths(),
      authenticated ? learning.list(controller.signal) : Promise.resolve([]),
    ])
      .then(([courses, paths, records]) => {
        if (!active) {
          return;
        }
        setCourses(
          courses.map((course) => {
            const record = records.find((item) => item.course.id === course.id);
            return record ? courseSummaryView(record.course) : course;
          }),
        );
        setPaths(paths);
        setEnrollments(records.map(enrollmentView));
        setError('');
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Les données sont indisponibles. Réessayez.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [catalog, learning, authenticated]);
  const loadCourse = useCallback(
    async (id: string) => {
      const course = await catalog.getCourse(id);
      setCourses((previous) => previous.map((item) => (item.id === id ? course : item)));
      return course;
    },
    [catalog],
  );
  const run = async (key: string, action: () => Promise<void>) => {
    if (!authenticated) {
      setError('Connectez-vous pour enregistrer votre apprentissage.');
      return;
    }
    setBusy(key);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Enregistrement impossible. Réessayez.',
      );
    } finally {
      setBusy('');
    }
  };
  const accept = (records: EnrollmentViewDto[]) => {
    setEnrollments((previous) => [
      ...previous.filter((item) => !records.some((record) => record.course.id === item.courseId)),
      ...records.map(enrollmentView),
    ]);
    setCourses((previous) =>
      previous.map((course) => {
        const record = records.find((item) => item.course.id === course.id);
        if (!record) {
          return course;
        }
        const updated = courseSummaryView(record.course);
        return 'lessons' in course
          ? { ...course, ...updated, description: course.description }
          : updated;
      }),
    );
  };
  return (
    <Context.Provider
      value={{
        courses,
        paths,
        enrollments,
        loadCourse,
        loading,
        error,
        busy,
        join: (id) => run(`course:${id}`, async () => accept([await learning.enroll(id)])),
        joinPath: (id) => run(`path:${id}`, async () => accept(await learning.enrollPath(id))),
        complete: (course, lessonId) =>
          run(`lesson:${lessonId}`, async () => {
            const progress = await learning.complete(course.id, lessonId, true);
            setEnrollments((previous) => [
              ...previous.filter((item) => item.courseId !== course.id),
              progressView(progress),
            ]);
          }),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useLearning() {
  const value = useContext(Context);
  if (!value) {
    throw new Error('LearningProvider manquant');
  }
  return value;
}

export function useCourse(id?: string) {
  const { loadCourse } = useLearning();
  const [course, setCourse] = useState<Course>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setCourse(undefined);
    setLoading(true);
    setError('');
    if (!id) {
      setLoading(false);
      return;
    }
    loadCourse(id)
      .then((result) => {
        if (active) {
          setCourse(result);
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(failure instanceof Error ? failure.message : 'Cours indisponible.');
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
  }, [id, loadCourse]);
  return { course, loading, error };
}

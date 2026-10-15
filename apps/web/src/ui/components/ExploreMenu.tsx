import { useLearning } from '../context';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ArrowUpRight } from 'lucide-react';
export function ExploreMenu() {
  const { courses, paths } = useLearning();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) {
      return;
    }
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="explore-menu" ref={ref}>
      <button
        ref={trigger}
        className="explore-trigger"
        aria-expanded={open}
        aria-controls="explore-panel"
        onClick={() => setOpen(!open)}
      >
        Explorer
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="explore-panel" id="explore-panel">
          <div>
            <span className="eyebrow">PAR MATIÈRE</span>
            {[...new Set(courses.map((course) => course.subject))].map((study) => (
              <Link key={study} to={`/catalogue?matiere=${encodeURIComponent(study)}`}>
                {study}
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
          <div>
            <span className="eyebrow">PAR NIVEAU</span>
            {[...new Set(courses.map((course) => course.level))].map((study) => (
              <Link key={study} to={`/catalogue?niveau=${encodeURIComponent(study)}`}>
                {study}
                <ArrowUpRight size={15} />
              </Link>
            ))}
            <Link to="/catalogue">
              Tous les cours
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="explore-goals">
            <span className="eyebrow">JE VEUX…</span>
            {paths.map((path) => (
              <Link key={path.id} to={`/parcours/${path.id}`}>
                {path.title}
              </Link>
            ))}
            <Link to="/mon-espace?onglet=favoris">Retrouver mes favoris</Link>
          </div>
        </div>
      )}
    </div>
  );
}

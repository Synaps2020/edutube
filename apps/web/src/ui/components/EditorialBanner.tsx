import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from './primitives';

interface EditorialBannerProps {
  tone: 'blue' | 'dark';
  eyebrow: string;
  title: ReactNode;
  description: string;
  action: { to: string; label: string };
  children: ReactNode;
  secondaryAction?: { to: string; label: string };
}

/** Encart partagé : les textes et boutons sont séparés du visuel. */
export function EditorialBanner({
  tone,
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
  children,
}: EditorialBannerProps) {
  return (
    <section className={`editorial-banner editorial-${tone}`}>
      <div className="editorial-copy">
        <span className="editorial-kicker">{eyebrow}</span>
        {tone === 'blue' ? <h1>{title}</h1> : <h2>{title}</h2>}
        <p>{description}</p>
        <div className="editorial-actions">
          <ButtonLink to={action.to}>
            {action.label}
            <ArrowRight size={18} />
          </ButtonLink>
          {secondaryAction && (
            <ButtonLink secondary to={secondaryAction.to}>
              {secondaryAction.label}
            </ButtonLink>
          )}
        </div>
      </div>
      <div className="editorial-visual">{children}</div>
    </section>
  );
}

import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context';
import { Bookmark } from 'lucide-react';
import { useStudy } from '../study-context';
export function FavoriteButton({
  courseId,
  compact = false,
}: {
  courseId: string;
  compact?: boolean;
}) {
  const { state, favorite, pendingFavorites, loading } = useStudy();
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = state.favorites.includes(courseId);
  return (
    <button
      type="button"
      className={`save-button ${saved ? 'saved' : ''} ${compact ? 'compact' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? 'Retirer des favoris' : 'Enregistrer pour plus tard'}
      disabled={loading || pendingFavorites.includes(courseId)}
      onClick={() => {
        if (session) {
          favorite(courseId);
        } else {
          navigate(`/connexion?retour=${encodeURIComponent(location.pathname + location.search)}`);
        }
      }}
    >
      <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
      {!compact && (saved ? 'Enregistré' : 'Enregistrer')}
    </button>
  );
}

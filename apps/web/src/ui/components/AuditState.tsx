const fieldLabels: Record<string, string> = {
  subject: 'Matière',
  schoolLevel: 'Niveau',
  palette: 'Couleur',
  illustration: 'Illustration',
  lessonCount: 'Chapitres',
  durationMinutes: 'Durée en minutes',
  learners: 'Inscriptions',
  updatedAt: 'Mise à jour',

  id: 'Identifiant',
  email: 'Adresse e-mail',
  displayName: 'Nom',
  role: 'Rôle',
  suspended: 'Accès suspendu',
  verified: 'Adresse vérifiée',
  revision: 'Révision',
  owner: 'Responsable',
  ownerId: 'Identifiant du responsable',
  owner_id: 'Identifiant du responsable',
  title: 'Titre',
  status: 'Publication',
  moderation: 'Modération',
  query: 'Recherche',
  page: 'Page',
  code: 'Résultat',
};
const valueLabels: Record<string, string> = {
  PRIMARY: 'Primaire',
  MIDDLE: 'Collège',
  SECONDARY: 'Lycée',
  blue: 'Bleu',
  green: 'Vert',
  orange: 'Orange',
  purple: 'Violet',
  geometry: 'Géométrie',
  plant: 'Sciences',
  writing: 'Écriture',
  code: 'Numérique',
  LEARNER: 'Apprenant',
  TEACHER: 'Enseignant',
  ADMIN: 'Enseignant référent',
  REGULATOR: 'Régulateur',
  SUPER_ADMIN: 'Super-admin',
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  ARCHIVED: 'Archivé',
  CLEAR: 'Aucune restriction',
  WITHDRAWN: 'Retiré',
  DELETED: 'Supprimé',
  FORBIDDEN: 'Droits insuffisants',
  REVISION_CONFLICT: 'Modification concurrente',
  CONFLICT: 'Conflit',
  VALIDATION_ERROR: 'Informations invalides',
  INTERNAL_ERROR: 'Service indisponible',
};
function displayValue(value: unknown): string {
  if (value === null || value === '') {
    return 'Non renseigné';
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }
  if (typeof value === 'string') {
    return valueLabels[value] ?? value;
  }
  return JSON.stringify(value);
}
export function AuditState({ value }: { value: Record<string, unknown> | null }) {
  if (!value) {
    return <p>Aucun état précédent.</p>;
  }
  return (
    <dl className="audit-state">
      {Object.entries(value).map(([name, content]) => (
        <div key={name}>
          <dt>{fieldLabels[name] ?? name}</dt>
          <dd>{displayValue(content)}</dd>
        </div>
      ))}
    </dl>
  );
}

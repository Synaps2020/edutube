import type { CatalogRepository } from '../application/ports';
import { demoMaterials } from './demo-materials';
import type { Course } from '../domain/course';
const lessons = (id: string, names: string[]) =>
  names.map((title, index) => ({
    id: `${id}-${index + 1}`,
    title,
    minutes: [8, 12, 15, 10][index] ?? 10,
  }));
const catalog: Omit<Course, 'material' | 'lessonCount'>[] = [
  {
    id: 'thales',
    title: 'La géométrie, enfin à votre portée',
    description:
      'Comprendre Thalès et Pythagore, reconnaître les bonnes situations et résoudre des problèmes avec méthode.',
    subject: 'Mathématiques',
    level: 'Collège',
    teacher: 'Moussa Ndiaye',
    duration: '2 h 20',
    rating: 4.9,
    learners: 1240,
    color: 'blue',
    illustration: 'geometry',
    featured: true,
    outcomes: [
      'Reconnaître des triangles semblables',
      'Appliquer le théorème de Thalès',
      'Résoudre un problème de géométrie',
    ],
    lessons: lessons('thales', [
      'Observer et comprendre les triangles',
      'Le théorème de Thalès pas à pas',
      'Passer de la figure au calcul',
      'À vous de jouer : problèmes guidés',
    ]),
  },
  {
    id: 'photosynthese',
    title: 'Explorer le monde vivant',
    description:
      'Des cellules aux écosystèmes : découvrez comment les plantes transforment la lumière en énergie.',
    subject: 'Sciences',
    level: 'Lycée',
    teacher: 'Aïssatou Fall',
    duration: '1 h 45',
    rating: 4.8,
    learners: 860,
    color: 'green',
    illustration: 'plant',
    outcomes: [
      'Expliquer la photosynthèse',
      'Identifier les besoins d’une plante',
      'Relier les plantes à leur écosystème',
    ],
    lessons: lessons('photosynthese', [
      'Une plante, comment ça fonctionne ?',
      'Le rôle de la lumière',
      'Une expérience pour comprendre',
      'Faire le bilan',
    ]),
  },
  {
    id: 'expression',
    title: 'Trouver les mots pour mieux écrire',
    description:
      'Construisez des textes clairs, organisez vos idées et prenez confiance dans votre expression écrite.',
    subject: 'Français',
    level: 'Collège',
    teacher: 'Fatou Diop',
    duration: '3 h 10',
    rating: 4.9,
    learners: 2100,
    color: 'orange',
    illustration: 'writing',
    featured: true,
    outcomes: [
      'Structurer un texte',
      'Construire une argumentation',
      'Relire et améliorer sa rédaction',
    ],
    lessons: lessons('expression', [
      'Une idée, un paragraphe',
      'Organiser ses arguments',
      'Donner du rythme à son texte',
      'Rédiger votre premier essai',
    ]),
  },
  {
    id: 'code',
    title: 'Vos premiers pas dans le numérique',
    description:
      'Apprenez la logique des algorithmes et créez votre premier projet, même si vous débutez.',
    subject: 'Numérique',
    level: 'Lycée',
    teacher: 'Ibrahima Sow',
    duration: '4 h 00',
    rating: 4.7,
    learners: 970,
    color: 'purple',
    illustration: 'code',
    outcomes: [
      'Comprendre un algorithme',
      'Utiliser les conditions et les boucles',
      'Concevoir un petit projet',
    ],
    lessons: lessons('code', [
      'Penser comme un programmeur',
      'Les conditions et les choix',
      'Répéter avec les boucles',
      'Créer votre premier projet',
    ]),
  },
  {
    id: 'fractions',
    title: 'Les fractions sans prise de tête',
    description:
      'Partager, comparer et calculer : construisez des bases solides avec des exemples du quotidien.',
    subject: 'Mathématiques',
    level: 'Primaire',
    teacher: 'Mariama Ba',
    duration: '1 h 30',
    rating: 4.8,
    learners: 1520,
    color: 'blue',
    illustration: 'geometry',
    outcomes: ['Lire une fraction', 'Comparer des fractions', 'Additionner des fractions simples'],
    lessons: lessons('fractions', [
      'Partager en parts égales',
      'Lire et représenter une fraction',
      'Comparer les parts',
      'Calculer ensemble',
    ]),
  },
  {
    id: 'lecture',
    title: 'Lire, comprendre et imaginer',
    description:
      'Des histoires et des exercices pour enrichir votre vocabulaire et retrouver le plaisir de lire.',
    subject: 'Français',
    level: 'Primaire',
    teacher: 'Fatou Diop',
    duration: '2 h 00',
    rating: 4.9,
    learners: 780,
    color: 'orange',
    illustration: 'writing',
    outcomes: [
      'Identifier les idées principales',
      'Comprendre les personnages',
      'Enrichir son vocabulaire',
    ],
    lessons: lessons('lecture', [
      'Entrer dans une histoire',
      'Comprendre les personnages',
      'Les mots et leurs nuances',
      'Raconter avec vos mots',
    ]),
  },
];
export const demoCourses: Course[] = catalog.map((course) => ({
  ...course,
  material: demoMaterials[course.id],
  lessonCount: course.lessons.length,
}));
export const demoCatalog: CatalogRepository = {
  async getCourse(id) {
    const course = demoCourses.find((item) => item.id === id);
    if (!course) {
      throw new Error('Cours introuvable');
    }
    return course;
  },
  async getCourses() {
    return demoCourses;
  },
  async getPaths() {
    return [
      {
        id: 'brevet',
        title: 'Cap sur le BFEM',
        description: 'Renforcez vos bases en mathématiques et en français, un cours après l’autre.',
        courseIds: ['thales', 'expression'],
        duration: '5 h 30',
      },
      {
        id: 'sciences',
        title: 'Comprendre, expérimenter, créer',
        description: 'Connectez les sciences au numérique et développez votre curiosité.',
        courseIds: ['photosynthese', 'code'],
        duration: '5 h 45',
      },
      {
        id: 'bases',
        title: 'Des bases pour aller plus loin',
        description: 'Un parcours progressif pour apprendre à lire et à calculer avec confiance.',
        courseIds: ['fractions', 'lecture'],
        duration: '3 h 30',
      },
    ];
  },
};

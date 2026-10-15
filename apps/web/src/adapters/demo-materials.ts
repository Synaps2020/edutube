import type { CourseMaterial } from '../domain/study';
export const demoMaterials: Record<string, CourseMaterial> = {
  thales: {
    prerequisites: ['Savoir calculer avec des proportions', 'Reconnaître des droites parallèles'],
    summary:
      'Lorsque deux triangles sont dans une configuration de Thalès, les côtés correspondants sont proportionnels. Repérez d’abord les points alignés et les droites parallèles avant d’écrire les rapports.',
    example:
      'Dans le triangle ABC, M est sur [AB] et N sur [AC], avec (MN) parallèle à (BC). Si AM = 3 cm, AB = 6 cm et AC = 8 cm, alors AM / AB = AN / AC : AN = 4 cm.',
    questions: [
      {
        id: 't1',
        prompt: 'Dans l’exemple, quel est le rapport AM / AB ?',
        options: ['1/2', '2', '3/8'],
        correctIndex: 0,
        explanation: '3 / 6 = 1 / 2. Le petit triangle est une réduction de rapport 1/2.',
      },
      {
        id: 't2',
        prompt: 'Quelle condition permet ici d’appliquer Thalès ?',
        options: [
          'Les triangles sont rectangles',
          'MN est parallèle à BC, avec M et N sur les côtés du triangle',
          'Tous les côtés sont égaux',
        ],
        correctIndex: 1,
        explanation: 'La configuration repose sur les alignements et le parallélisme.',
      },
    ],
  },
  photosynthese: {
    prerequisites: ['Identifier les principales parties d’une plante'],
    summary:
      'Les plantes chlorophylliennes utilisent l’énergie lumineuse pour produire de la matière organique à partir d’eau et de dioxyde de carbone. Cette photosynthèse libère du dioxygène.',
    example:
      'Une feuille éclairée reçoit de l’eau par les racines et du dioxyde de carbone par les échanges avec l’air. La lumière apporte l’énergie nécessaire à la fabrication de matière organique.',
    questions: [
      {
        id: 'p1',
        prompt: 'Quelle est la source d’énergie de la photosynthèse ?',
        options: ['La lumière', 'Le dioxygène', 'Le sol uniquement'],
        correctIndex: 0,
        explanation: 'L’énergie lumineuse permet les transformations de la photosynthèse.',
      },
      {
        id: 'p2',
        prompt: 'Quel gaz est utilisé pour fabriquer de la matière organique ?',
        options: ['Le dioxygène', 'Le dioxyde de carbone', 'L’hélium'],
        correctIndex: 1,
        explanation: 'La plante utilise le dioxyde de carbone et libère du dioxygène.',
      },
    ],
  },
  expression: {
    prerequisites: ['Savoir construire une phrase simple'],
    summary:
      'Un paragraphe argumentatif développe une idée principale. Une explication et un exemple rendent cette idée plus claire. Les connecteurs aident le lecteur à suivre le raisonnement.',
    example:
      '« Lire régulièrement enrichit le vocabulaire. En effet, les histoires nous exposent à des mots variés. Par exemple, un récit de voyage permet de découvrir le vocabulaire des paysages. »',
    questions: [
      {
        id: 'e1',
        prompt: 'Quel connecteur introduit un exemple ?',
        options: ['Par exemple', 'Cependant', 'Pour conclure'],
        correctIndex: 0,
        explanation: '« Par exemple » annonce une illustration concrète de l’idée.',
      },
      {
        id: 'e2',
        prompt: 'Que doit développer un paragraphe argumentatif ?',
        options: [
          'Une seule liste de mots',
          'Une idée principale expliquée et illustrée',
          'Uniquement une conclusion',
        ],
        correctIndex: 1,
        explanation: 'Une idée, une explication et un exemple donnent une structure claire.',
      },
    ],
  },
  code: {
    prerequisites: ['Aucun prérequis en programmation'],
    summary:
      'Un algorithme est une suite d’instructions pour résoudre un problème. Une condition choisit une action selon une situation. Une boucle répète une action.',
    example:
      'Pour arroser trois plantes : répéter trois fois « prendre une plante et l’arroser ». Si la terre est déjà humide, ne pas ajouter d’eau. La boucle organise la répétition ; la condition adapte l’action.',
    questions: [
      {
        id: 'c1',
        prompt: 'Quelle structure permet de répéter une action ?',
        options: ['Une boucle', 'Un commentaire', 'Une image'],
        correctIndex: 0,
        explanation: 'La boucle répète des instructions selon un nombre ou une condition.',
      },
      {
        id: 'c2',
        prompt: 'Quel est le rôle d’une condition ?',
        options: [
          'Toujours répéter dix fois',
          'Choisir une action selon une situation',
          'Effacer toutes les instructions',
        ],
        correctIndex: 1,
        explanation:
          'Une condition permet d’exécuter des instructions si un critère est satisfait.',
      },
    ],
  },
  fractions: {
    prerequisites: ['Savoir compter et partager en parts égales'],
    summary:
      'Une fraction représente une ou plusieurs parts d’un tout partagé en parts égales. Le dénominateur indique le nombre de parts du tout ; le numérateur indique les parts prises.',
    example:
      'Un gâteau est partagé en quatre parts égales. Si vous en prenez une, vous avez 1/4 du gâteau. Deux parts représentent 2/4, soit la moitié.',
    questions: [
      {
        id: 'f1',
        prompt: 'Dans 1/4, que représente le 4 ?',
        options: ['Le nombre total de parts égales', 'Le nombre de gâteaux', 'Les parts prises'],
        correctIndex: 0,
        explanation: 'Le dénominateur 4 indique que le tout est partagé en quatre parts égales.',
      },
      {
        id: 'f2',
        prompt: 'Quelle fraction est égale à la moitié ?',
        options: ['1/4', '2/4', '3/4'],
        correctIndex: 1,
        explanation: 'Deux parts sur quatre, c’est la moitié du tout.',
      },
    ],
  },
  lecture: {
    prerequisites: ['Savoir lire des phrases courtes'],
    summary:
      'Pour comprendre une histoire, repérez les personnages, le lieu et les événements. Cherchez dans le texte les indices qui justifient vos réponses, plutôt que de deviner.',
    example:
      '« Awa ouvrit son cahier sous le baobab. Le vent tourna une page. Elle sourit et recommença sa lecture. » Le personnage est Awa ; elle lit dehors, sous un baobab.',
    questions: [
      {
        id: 'l1',
        prompt: 'Où se déroule cette scène ?',
        options: ['Sous un baobab', 'Dans une voiture', 'Dans une cuisine'],
        correctIndex: 0,
        explanation: 'Le texte indique directement « sous le baobab ».',
      },
      {
        id: 'l2',
        prompt: 'Quelle action Awa fait-elle à la fin ?',
        options: [
          'Elle ferme son cahier',
          'Elle recommence sa lecture',
          'Elle court vers la maison',
        ],
        correctIndex: 1,
        explanation: 'La dernière phrase dit qu’elle recommence sa lecture.',
      },
    ],
  },
};

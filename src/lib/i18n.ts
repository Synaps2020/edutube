// Internationalisation légère de l'interface : français par défaut, wolof et arabe en option.
// Les dictionnaires wolof/arabe couvrent la navigation et les actions principales ; toute clé
// manquante retombe sur le français. La langue est mémorisée dans le cookie `locale`.

export type Locale = 'fr' | 'wo' | 'ar';
export const LOCALES: Array<{ code: Locale; label: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'wo', label: 'Wolof', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

const fr = {
  'app.name': 'EduTube',
  'app.tagline': 'La plateforme pédagogique vidéo et audio du Ministère de l’Éducation nationale',
  'nav.home': 'Accueil',
  'nav.catalog': 'Catalogue',
  'nav.channels': 'Chaînes',
  'nav.search': 'Rechercher',
  'nav.mySpace': 'Mon espace',
  'nav.submit': 'Proposer un contenu',
  'nav.admin': 'Administration',
  'nav.login': 'Se connecter',
  'nav.register': 'Créer un compte',
  'nav.logout': 'Se déconnecter',
  'nav.notifications': 'Notifications',
  'search.placeholder': 'Rechercher un cours, un chapitre, un mot-clé…',
  'home.hero.title': 'Apprendre et enseigner, partout au Sénégal',
  'home.hero.subtitle': 'Des vidéos et des audios pédagogiques validés par le Ministère, du CI à la Terminale, en français, en wolof et en arabe.',
  'home.latest': 'Dernières publications',
  'home.popular': 'Les plus consultés',
  'home.byCycle': 'Explorer par cycle',
  'home.byDiscipline': 'Explorer par discipline',
  'home.byTheme': 'Explorer par thématique',
  'media.video': 'Vidéo',
  'media.audio': 'Audio',
  'media.views': 'vues',
  'media.like': 'J’aime',
  'media.favorite': 'Favori',
  'media.share': 'Partager',
  'media.recommend': 'Recommander',
  'media.download': 'Télécharger',
  'media.report': 'Signaler',
  'media.addToPlaylist': 'Ajouter à une liste',
  'media.comments': 'Commentaires',
  'media.transcript': 'Transcription',
  'media.published': 'Publié le',
  'media.license': 'Licence',
  'media.author': 'Auteur pédagogique',
  'media.chapter': 'Chapitre',
  'media.keywords': 'Mots-clés',
  'filters.cycle': 'Cycle',
  'filters.class': 'Classe',
  'filters.discipline': 'Discipline',
  'filters.theme': 'Thématique',
  'filters.language': 'Langue',
  'filters.difficulty': 'Niveau',
  'filters.duration': 'Durée',
  'filters.type': 'Type',
  'filters.date': 'Date de publication',
  'filters.sort': 'Trier par',
  'filters.reset': 'Réinitialiser',
  'common.all': 'Tous',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.delete': 'Supprimer',
  'common.loading': 'Chargement…',
  'common.empty': 'Aucun contenu pour le moment.',
  'common.seeAll': 'Voir tout',
  'common.back': 'Retour',
  'footer.legal': 'Mentions légales',
  'footer.charter': 'Charte communautaire',
  'footer.about': 'À propos',
  'footer.ministry': 'Ministère de l’Éducation nationale — République du Sénégal',
};

const wo: Partial<typeof fr> = {
  'nav.home': 'Kër gi',
  'nav.catalog': 'Catalogue bi',
  'nav.channels': 'Kanaal yi',
  'nav.search': 'Seet',
  'nav.mySpace': 'Sama bérab',
  'nav.submit': 'Yónnee ab ndimbal',
  'nav.admin': 'Doxalin',
  'nav.login': 'Dugg',
  'nav.register': 'Sos ab kont',
  'nav.logout': 'Génn',
  'search.placeholder': 'Seet ab njàng, ab chapitre, ab baat…',
  'home.hero.title': 'Jàng ak jàngale, fu nekk ci Senegaal',
  'home.hero.subtitle': 'Wideo ak ojo yu njàng yu Ministeer bi nangu, dale ci CI ba Terminale, ci farañse, wolof ak araab.',
  'home.latest': 'Li mujj a génn',
  'home.popular': 'Li ñu gën a seetaan',
  'home.byCycle': 'Wër ci cycle',
  'home.byDiscipline': 'Wër ci discipline',
  'home.byTheme': 'Wër ci téma',
  'media.video': 'Wideo',
  'media.audio': 'Ojo',
  'media.views': 'seetaan',
  'media.like': 'Bëgg naa',
  'media.share': 'Séddoo',
  'media.comments': 'Xalaat yi',
  'common.all': 'Lépp',
  'common.save': 'Denc',
  'common.cancel': 'Bàyyi',
  'common.empty': 'Amul dara ba léegi.',
  'common.seeAll': 'Gis lépp',
  'common.back': 'Dellu',
};

const ar: Partial<typeof fr> = {
  'nav.home': 'الرئيسية',
  'nav.catalog': 'الفهرس',
  'nav.channels': 'القنوات',
  'nav.search': 'بحث',
  'nav.mySpace': 'فضائي',
  'nav.submit': 'اقتراح محتوى',
  'nav.admin': 'الإدارة',
  'nav.login': 'تسجيل الدخول',
  'nav.register': 'إنشاء حساب',
  'nav.logout': 'تسجيل الخروج',
  'search.placeholder': 'ابحث عن درس أو فصل أو كلمة مفتاحية…',
  'home.hero.title': 'التعلّم والتعليم في كل أنحاء السنغال',
  'home.hero.subtitle': 'مقاطع فيديو وصوتيات تربوية معتمدة من الوزارة، من CI إلى Terminale، بالفرنسية والولوف والعربية.',
  'home.latest': 'آخر المنشورات',
  'home.popular': 'الأكثر مشاهدة',
  'home.byCycle': 'تصفح حسب المرحلة',
  'home.byDiscipline': 'تصفح حسب المادة',
  'home.byTheme': 'تصفح حسب الموضوع',
  'media.video': 'فيديو',
  'media.audio': 'صوت',
  'media.views': 'مشاهدة',
  'media.like': 'أعجبني',
  'media.share': 'مشاركة',
  'media.comments': 'التعليقات',
  'common.all': 'الكل',
  'common.save': 'حفظ',
  'common.cancel': 'إلغاء',
  'common.empty': 'لا يوجد محتوى حالياً.',
  'common.seeAll': 'عرض الكل',
  'common.back': 'رجوع',
};

export type Dictionary = typeof fr;
export type TKey = keyof Dictionary;

export function getDictionary(locale: Locale): Dictionary {
  if (locale === 'wo') return { ...fr, ...wo };
  if (locale === 'ar') return { ...fr, ...ar };
  return fr;
}

export function normalizeLocale(v: string | undefined | null): Locale {
  return v === 'wo' || v === 'ar' ? v : 'fr';
}

export function dirOf(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

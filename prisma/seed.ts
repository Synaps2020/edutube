/* eslint-disable no-console */
// Jeu de données de démonstration — EduTube
// Exécution : npm run db:seed (ou automatiquement par le conteneur `migrate` de docker-compose).
//
// Contenu :
//  - cycles et classes du système éducatif sénégalais (CI → Terminale)
//  - disciplines officielles et thématiques transversales
//  - un compte par rôle (+ quelques élèves et un second enseignant)
//  - une chaîne officielle MEN et une chaîne enseignant
//  - des médias dans plusieurs statuts (fichiers de démonstration générés avec FFmpeg,
//    transcodés ensuite par le worker), des propositions, commentaires, listes, etc.
//
// Idempotent : relancer le seed ne duplique pas les référentiels ni les comptes.

import { PrismaClient, MediaType, Language, Difficulty } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const MEDIA_ROOT = path.resolve(process.env.MEDIA_ROOT ?? './data/media');
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Passer@2026';

function slugify(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
function shortCode(len = 7) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Génère un fichier vidéo ou audio de démonstration (mire + son) si FFmpeg est disponible.
function generateDemoFile(type: MediaType, mediaId: string, seconds: number, freq: number): { rel: string; size: number } | null {
  if (!hasFfmpeg()) return null;
  const relDir = path.join('originals', mediaId);
  fs.mkdirSync(path.join(MEDIA_ROOT, relDir), { recursive: true });
  const fileName = type === 'VIDEO' ? 'demo.mp4' : 'demo.wav';
  const rel = path.join(relDir, fileName);
  const out = path.join(MEDIA_ROOT, rel);
  if (fs.existsSync(out)) return { rel, size: fs.statSync(out).size };
  const args =
    type === 'VIDEO'
      ? ['-y', '-f', 'lavfi', '-i', `testsrc2=size=1280x720:rate=25`, '-f', 'lavfi', '-i', `sine=frequency=${freq}:sample_rate=44100`,
         '-t', String(seconds), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-shortest', out]
      : ['-y', '-f', 'lavfi', '-i', `sine=frequency=${freq}:sample_rate=44100`, '-f', 'lavfi', '-i', `sine=frequency=${freq * 1.5}:sample_rate=44100`,
         '-filter_complex', '[0:a][1:a]amix=inputs=2,tremolo=f=0.5:d=0.7,volume=-6dB', '-t', String(seconds), '-ac', '2', out];
  try {
    execFileSync('ffmpeg', args, { stdio: 'ignore' });
    return { rel, size: fs.statSync(out).size };
  } catch (e) {
    console.warn('  ! génération FFmpeg impossible pour', mediaId, e);
    return null;
  }
}

async function main() {
  console.log('→ Référentiels (cycles, classes, disciplines, thématiques)');
  const cyclesData = [
    { code: 'PRIMAIRE', name: 'Primaire (élémentaire)', order: 1, classes: [
      ['CI', 'Cours d’initiation (CI)'], ['CP', 'Cours préparatoire (CP)'], ['CE1', 'Cours élémentaire 1re année (CE1)'],
      ['CE2', 'Cours élémentaire 2e année (CE2)'], ['CM1', 'Cours moyen 1re année (CM1)'], ['CM2', 'Cours moyen 2e année (CM2)'] ] },
    { code: 'MOYEN', name: 'Moyen (collège)', order: 2, classes: [['6E', 'Sixième (6e)'], ['5E', 'Cinquième (5e)'], ['4E', 'Quatrième (4e)'], ['3E', 'Troisième (3e)']] },
    { code: 'SECONDAIRE', name: 'Secondaire (lycée)', order: 3, classes: [['2NDE', 'Seconde'], ['1ERE', 'Première'], ['TLE', 'Terminale']] },
  ];
  const classByCode: Record<string, { id: string; cycleId: string }> = {};
  for (const c of cyclesData) {
    const cycle = await prisma.cycle.upsert({ where: { code: c.code }, update: { name: c.name, order: c.order }, create: { code: c.code, name: c.name, order: c.order } });
    let i = 0;
    for (const [code, name] of c.classes) {
      i += 1;
      const cl = await prisma.classLevel.upsert({ where: { code }, update: { name, order: i, cycleId: cycle.id }, create: { code, name, order: i, cycleId: cycle.id } });
      classByCode[code] = { id: cl.id, cycleId: cycle.id };
    }
  }

  const disciplinesData: Array<[string, string, string]> = [
    ['MATHS', 'Mathématiques', '#00853F'], ['FRANCAIS', 'Français', '#1D4ED8'], ['ARABE', 'Arabe', '#7C3AED'],
    ['ANGLAIS', 'Anglais', '#DB2777'], ['HIST_GEO', 'Histoire-Géographie', '#B45309'], ['SVT', 'Sciences de la Vie et de la Terre (SVT)', '#15803D'],
    ['PC', 'Physique-Chimie', '#0E7490'], ['PHILO', 'Philosophie', '#4B5563'], ['INFO', 'Informatique', '#0F766E'],
    ['EPS', 'Éducation physique et sportive (EPS)', '#E31B23'], ['EDUC_CIVIQUE', 'Éducation civique', '#CA8A04'],
    ['LANGUES_NAT', 'Langues nationales', '#9333EA'], ['ECO', 'Économie et gestion', '#334155'],
  ];
  const disc: Record<string, string> = {};
  for (const [code, name, color] of disciplinesData) {
    const d = await prisma.discipline.upsert({ where: { code }, update: { name, color }, create: { code, name, color } });
    disc[code] = d.id;
  }

  const themesData: Array<[string, string, string]> = [
    ['SCIENCES', 'Sciences', 'Mathématiques, SVT, physique-chimie, démarche scientifique'],
    ['LANGUES', 'Langues', 'Français, arabe, anglais, langues nationales'],
    ['HUMANITES', 'Humanités', 'Histoire, géographie, philosophie, lettres'],
    ['ARTS', 'Arts et culture', 'Musique, arts plastiques, patrimoine'],
    ['CIVISME', 'Éducation civique et citoyenneté', 'Institutions, droits et devoirs, vivre-ensemble'],
    ['NUMERIQUE', 'Numérique', 'Informatique, culture numérique, sécurité en ligne'],
    ['EPS_SANTE', 'EPS et santé', 'Sport, hygiène, prévention'],
    ['ENVIRONNEMENT', 'Environnement et développement durable', 'Climat, biodiversité, déchets'],
    ['ORIENTATION', 'Orientation et méthodologie', 'Méthodes de travail, examens, métiers'],
  ];
  const theme: Record<string, string> = {};
  for (const [code, name, description] of themesData) {
    const t = await prisma.theme.upsert({ where: { code }, update: { name, description }, create: { code, name, description } });
    theme[code] = t.id;
  }

  console.log('→ Comptes de démonstration (mot de passe commun : ' + DEMO_PASSWORD + ')');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const upsertUser = (data: { email: string; firstName: string; lastName: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT'; classLevelId?: string; establishment?: string; region?: string; ief?: string; ia?: string; bio?: string }) =>
    prisma.user.upsert({ where: { email: data.email }, update: {}, create: { ...data, passwordHash } });

  const admin = await upsertUser({ email: 'admin@education.sn', firstName: 'Aminata', lastName: 'BA', role: 'ADMIN', establishment: 'MEN — Cellule pédagogique numérique', region: 'Dakar', ia: 'IA de Dakar', bio: 'Cellule pédagogique numérique du Ministère de l’Éducation nationale.' });
  const admin2 = await upsertUser({ email: 'moderation@education.sn', firstName: 'Ousmane', lastName: 'Sarr', role: 'ADMIN', establishment: 'MEN — Direction de la Formation et de la Communication', region: 'Dakar', ia: 'IA de Dakar' });
  const teacher = await upsertUser({ email: 'enseignant@education.sn', firstName: 'Moussa', lastName: 'Ndiaye', role: 'TEACHER', establishment: 'Lycée Blaise Diagne', region: 'Dakar', ief: 'IEF Dakar-Plateau', ia: 'IA de Dakar', bio: 'Professeur de mathématiques, Lycée Blaise Diagne (Dakar).' });
  const teacher2 = await upsertUser({ email: 'enseignante@education.sn', firstName: 'Fatou', lastName: 'Bâ', role: 'TEACHER', establishment: 'École élémentaire Ndiarème Limamoulaye', region: 'Dakar', ief: 'IEF Guédiawaye', ia: 'IA de Pikine-Guédiawaye', bio: 'Institutrice au CM2, passionnée de lecture.' });
  const student = await upsertUser({ email: 'eleve@education.sn', firstName: 'Awa', lastName: 'Faye', role: 'STUDENT', classLevelId: classByCode['3E'].id, establishment: 'CEM de Thiès-Nord', region: 'Thiès', ief: 'IEF Thiès-Ville', ia: 'IA de Thiès' });
  const student2 = await upsertUser({ email: 'eleve2@education.sn', firstName: 'Ibrahima', lastName: 'Sow', role: 'STUDENT', classLevelId: classByCode['3E'].id, establishment: 'CEM de Thiès-Nord', region: 'Thiès', ief: 'IEF Thiès-Ville', ia: 'IA de Thiès' });
  const student3 = await upsertUser({ email: 'eleve3@education.sn', firstName: 'Mariama', lastName: 'Diop', role: 'STUDENT', classLevelId: classByCode['TLE'].id, establishment: 'Lycée Djignabo', region: 'Ziguinchor', ief: 'IEF Ziguinchor', ia: 'IA de Ziguinchor' });
  const student4 = await upsertUser({ email: 'eleve4@education.sn', firstName: 'Cheikh', lastName: 'Gueye', role: 'STUDENT', classLevelId: classByCode['CM2'].id, establishment: 'École élémentaire Ndiarème Limamoulaye', region: 'Dakar', ief: 'IEF Guédiawaye', ia: 'IA de Pikine-Guédiawaye' });

  console.log('→ Chaînes');
  const menChannel = await prisma.channel.upsert({
    where: { slug: 'men-cellule-pedagogique-numerique' },
    update: {},
    create: { slug: 'men-cellule-pedagogique-numerique', name: 'MEN — Cellule pédagogique numérique', description: 'Chaîne officielle du Ministère de l’Éducation nationale : ressources validées pour tous les cycles.', isOfficial: true, ownerId: admin.id },
  });
  const examChannel = await prisma.channel.upsert({
    where: { slug: 'preparation-aux-examens' },
    update: {},
    create: { slug: 'preparation-aux-examens', name: 'Préparation aux examens (CFEE, BFEM, Baccalauréat)', description: 'Révisions, annales commentées et conseils méthodologiques pour les examens nationaux.', isOfficial: true, ownerId: admin2.id },
  });
  const teacherChannel = await prisma.channel.upsert({
    where: { slug: 'moussa-ndiaye-maths' },
    update: {},
    create: { slug: 'moussa-ndiaye-maths', name: 'Les maths avec M. Ndiaye', description: 'Cours et exercices de mathématiques pour le collège et le lycée, par Moussa Ndiaye (Lycée Blaise Diagne).', isOfficial: false, ownerId: teacher.id },
  });

  await prisma.subscription.createMany({ data: [
    { userId: student.id, channelId: menChannel.id }, { userId: student.id, channelId: teacherChannel.id },
    { userId: student2.id, channelId: menChannel.id }, { userId: teacher.id, channelId: menChannel.id }, { userId: student3.id, channelId: examChannel.id },
  ], skipDuplicates: true });

  console.log('→ Médias de démonstration');
  type Demo = {
    key: string; type: MediaType; title: string; description: string; classe: string; discipline: string; theme: string; chapter: string; keywords: string[];
    language?: Language; difficulty?: Difficulty; channelId?: string; author: string; status: 'PROCESSING' | 'DRAFT' | 'ARCHIVED' | 'REJECTED'; seconds?: number; freq?: number;
    contributorId?: string; downloadable?: boolean; transcript?: string; rejectionReason?: string; views?: number;
  };
  const demos: Demo[] = [
    { key: 'thales', type: 'VIDEO', title: 'Le théorème de Thalès — cours complet (3e)', description: 'Énoncé, réciproque et applications du théorème de Thalès, avec des exercices corrigés issus des annales du BFEM. Ce cours s’adresse aux élèves de 3e et reprend les prérequis de 4e.', classe: '3E', discipline: 'MATHS', theme: 'SCIENCES', chapter: 'Géométrie — Théorème de Thalès', keywords: ['Thalès', 'géométrie', 'BFEM', 'proportionnalité'], author: 'Moussa Ndiaye, professeur de mathématiques', status: 'PROCESSING', seconds: 30, freq: 440, contributorId: teacher.id, downloadable: true, views: 1240,
      transcript: 'Bonjour à tous. Aujourd’hui nous étudions le théorème de Thalès. Soit un triangle ABC, et deux points M et N situés respectivement sur les côtés AB et AC. Si les droites (MN) et (BC) sont parallèles, alors AM sur AB égale AN sur AC égale MN sur BC…' },
    { key: 'lecture-cm2', type: 'VIDEO', title: 'Lecture compréhension : « Le baobab et le vent » (CM2)', description: 'Séance de lecture suivie et de compréhension à partir d’un conte sénégalais. Vocabulaire, idées principales et questions de compréhension pour préparer le CFEE.', classe: 'CM2', discipline: 'FRANCAIS', theme: 'LANGUES', chapter: 'Lecture suivie — Contes et récits', keywords: ['lecture', 'conte', 'CFEE', 'compréhension'], author: 'Fatou Bâ, institutrice', status: 'PROCESSING', seconds: 25, freq: 523, difficulty: 'DECOUVERTE', contributorId: teacher2.id, views: 860 },
    { key: 'photosynthese', type: 'VIDEO', title: 'La photosynthèse expliquée simplement (Seconde)', description: 'Comment les plantes fabriquent leur matière organique à partir de la lumière : mise en évidence expérimentale, équation bilan et rôle dans les écosystèmes sahéliens.', classe: '2NDE', discipline: 'SVT', theme: 'SCIENCES', chapter: 'Nutrition des végétaux chlorophylliens', keywords: ['photosynthèse', 'chlorophylle', 'écosystème'], author: 'Cellule pédagogique numérique — MEN', status: 'PROCESSING', seconds: 28, freq: 392, views: 540 },
    { key: 'independance', type: 'VIDEO', title: 'Le Sénégal de 1960 : l’accession à l’indépendance (Terminale)', description: 'Contexte international, Fédération du Mali, proclamation du 4 avril 1960 et mise en place des institutions. Chronologie commentée et documents d’archives.', classe: 'TLE', discipline: 'HIST_GEO', theme: 'HUMANITES', chapter: 'Décolonisation et indépendances africaines', keywords: ['indépendance', '1960', 'Fédération du Mali', 'Senghor'], author: 'Inspection d’Académie de Dakar — cellule histoire', status: 'PROCESSING', seconds: 30, freq: 330, difficulty: 'APPROFONDISSEMENT', channelId: examChannel.id, views: 2210 },
    { key: 'fractions-wolof', type: 'AUDIO', title: 'Les fractions expliquées en wolof (CM1)', description: 'Capsule audio en wolof pour comprendre les fractions : numérateur, dénominateur, comparaison et fractions équivalentes, avec des exemples de la vie quotidienne (partage du thiéboudienne, marché).', classe: 'CM1', discipline: 'MATHS', theme: 'SCIENCES', chapter: 'Nombres — Les fractions', keywords: ['fractions', 'wolof', 'langues nationales'], language: 'WO', author: 'Cellule pédagogique numérique — MEN', status: 'PROCESSING', seconds: 40, freq: 220, difficulty: 'DECOUVERTE', downloadable: true, views: 1530,
      transcript: 'Tey dinanu jàng fractions. Fraction mooy xaaj. Su ñu xaajee ab mburu ci ñaari xaaj yu tolloo, benn xaaj bu nekk mooy benn ci ñaar…' },
    { key: 'dictee-6e', type: 'AUDIO', title: 'Dictée préparée : « Un matin à Saint-Louis » (6e)', description: 'Dictée audio avec lecture lente puis lecture normale, suivie des points de vigilance orthographiques (accords, homophones). Texte disponible dans la transcription pour l’autocorrection.', classe: '6E', discipline: 'FRANCAIS', theme: 'LANGUES', chapter: 'Orthographe — Dictées préparées', keywords: ['dictée', 'orthographe', 'accords'], author: 'Cellule pédagogique numérique — MEN', status: 'PROCESSING', seconds: 35, freq: 294, downloadable: true, views: 410,
      transcript: 'Un matin à Saint-Louis. Le soleil se lève lentement sur le fleuve. Les pirogues colorées reviennent de la pêche, chargées de poissons…' },
    { key: 'arabe-salutations', type: 'AUDIO', title: 'التحيات والتعارف — Les salutations en arabe (CE2)', description: 'Leçon audio d’initiation à l’arabe : formules de salutation, se présenter, remercier. Prononciation lente et répétée.', classe: 'CE2', discipline: 'ARABE', theme: 'LANGUES', chapter: 'Expression orale — Se présenter', keywords: ['arabe', 'salutations', 'oral'], language: 'AR', author: 'Inspection de l’enseignement arabe — MEN', status: 'PROCESSING', seconds: 30, freq: 349, difficulty: 'DECOUVERTE', views: 275 },
    { key: 'citoyennete', type: 'VIDEO', title: 'Les symboles de la République : drapeau, devise, hymne (CE2)', description: 'Découverte des symboles nationaux du Sénégal : le drapeau vert-jaune-rouge à l’étoile verte, la devise « Un Peuple, Un But, Une Foi » et l’hymne national « Le Lion rouge ».', classe: 'CE2', discipline: 'EDUC_CIVIQUE', theme: 'CIVISME', chapter: 'Les symboles de la Nation', keywords: ['drapeau', 'devise', 'hymne', 'République'], author: 'Cellule pédagogique numérique — MEN', status: 'PROCESSING', seconds: 22, freq: 466, difficulty: 'DECOUVERTE', views: 980 },
    { key: 'algo-brouillon', type: 'VIDEO', title: 'Initiation à l’algorithmique avec Scratch (4e)', description: 'Premiers pas avec Scratch : séquences, boucles et conditions à travers la création d’un petit jeu. Brouillon en cours de finalisation par la cellule.', classe: '4E', discipline: 'INFO', theme: 'NUMERIQUE', chapter: 'Algorithmique et programmation', keywords: ['Scratch', 'algorithme', 'boucle'], author: 'Cellule pédagogique numérique — MEN', status: 'DRAFT', seconds: 20, freq: 262 },
    { key: 'ancien-programme', type: 'VIDEO', title: 'Ancien programme : la Révolution française (4e) — version 2019', description: 'Version archivée remplacée par une nouvelle capsule conforme au curriculum actualisé.', classe: '4E', discipline: 'HIST_GEO', theme: 'HUMANITES', chapter: 'Révolution française', keywords: ['révolution', 'archive'], author: 'Cellule pédagogique numérique — MEN', status: 'ARCHIVED', views: 3100 },
    { key: 'rejete-qualite', type: 'AUDIO', title: 'Conjugaison : le passé composé (CE1) — enregistrement', description: 'Enregistrement proposé pour le CE1 sur le passé composé.', classe: 'CE1', discipline: 'FRANCAIS', theme: 'LANGUES', chapter: 'Conjugaison — Le passé composé', keywords: ['conjugaison', 'passé composé'], author: 'Enseignant contributeur', status: 'REJECTED', contributorId: teacher2.id, rejectionReason: 'Qualité sonore insuffisante (bruit de fond important) et absence de la fiche de séquence. Merci de réenregistrer dans un lieu calme et de joindre la fiche pédagogique.' },
  ];

  const mediaByKey: Record<string, string> = {};
  for (const d of demos) {
    const slug = slugify(d.title);
    const existing = await prisma.media.findUnique({ where: { slug } });
    const cl = classByCode[d.classe];
    const data = {
      slug, type: d.type, title: d.title, description: d.description, cycleId: cl.cycleId, classLevelId: cl.id,
      disciplineId: disc[d.discipline], themeId: theme[d.theme], chapter: d.chapter, keywords: d.keywords,
      language: d.language ?? 'FR', difficulty: d.difficulty ?? 'INTERMEDIAIRE', pedagogicalAuthor: d.author,
      uploaderId: admin.id, contributorId: d.contributorId ?? null, channelId: d.channelId ?? menChannel.id,
      downloadable: d.downloadable ?? false, transcript: d.transcript ?? null, viewCount: d.views ?? 0,
      rejectionReason: d.rejectionReason ?? null,
    };
    let media;
    if (existing) {
      media = existing;
    } else {
      media = await prisma.media.create({ data: { ...data, shortCode: shortCode(), status: d.status === 'PROCESSING' ? 'DRAFT' : d.status, archivedAt: d.status === 'ARCHIVED' ? new Date() : null, publishedAt: d.status === 'ARCHIVED' ? new Date('2019-10-01') : null } });
      if (d.status === 'PROCESSING' || d.status === 'DRAFT') {
        const gen = generateDemoFile(d.type, media.id, d.seconds ?? 20, d.freq ?? 440);
        if (gen) {
          await prisma.media.update({ where: { id: media.id }, data: { originalPath: gen.rel, originalName: path.basename(gen.rel), originalSize: BigInt(gen.size), status: d.status === 'PROCESSING' ? 'PROCESSING' : 'DRAFT' } });
          await prisma.job.create({ data: { type: d.type === 'VIDEO' ? 'TRANSCODE_VIDEO' : 'PROCESS_AUDIO', mediaId: media.id, payload: { publishWhenDone: d.status === 'PROCESSING' } } });
        } else {
          console.warn(`  ! FFmpeg indisponible : "${d.title}" reste en brouillon sans fichier.`);
        }
      }
    }
    mediaByKey[d.key] = media.id;
  }

  console.log('→ Propositions (workflow de soumission)');
  const cntSub = await prisma.submission.count();
  if (cntSub === 0) {
    await prisma.submission.createMany({ data: [
      { type: 'VIDEO', title: 'Résolution d’équations du premier degré (4e)', description: 'Capsule de 8 minutes filmée en classe : méthode pas à pas, erreurs fréquentes et exercices d’application.', cycleId: classByCode['4E'].cycleId, classLevelId: classByCode['4E'].id, disciplineId: disc['MATHS'], themeId: theme['SCIENCES'], chapter: 'Équations du premier degré', keywords: ['équation', 'algèbre'], language: 'FR', sourceUrl: 'https://partage.education.sn/d/equations-4e', authorId: teacher.id, status: 'PENDING' },
      { type: 'AUDIO', title: 'Podcast élèves : « Notre visite au Musée des Civilisations noires »', description: 'Reportage audio réalisé par la classe de 3e B du CEM de Thiès-Nord dans le cadre du projet Histoire et patrimoine.', cycleId: classByCode['3E'].cycleId, classLevelId: classByCode['3E'].id, disciplineId: disc['HIST_GEO'], themeId: theme['ARTS'], keywords: ['musée', 'patrimoine', 'podcast'], language: 'FR', authorId: student.id, status: 'PENDING' },
      { type: 'VIDEO', title: 'Expérience : l’eau et ses trois états (CE2)', description: 'Expériences filmées en classe (glace, eau, vapeur) avec les élèves de CE2.', cycleId: classByCode['CE2'].cycleId, classLevelId: classByCode['CE2'].id, disciplineId: disc['SVT'], themeId: theme['SCIENCES'], keywords: ['eau', 'états de la matière'], language: 'FR', authorId: teacher2.id, status: 'REJECTED', reviewerId: admin.id, reviewNote: 'Merci pour cette proposition. Les visages des élèves sont identifiables : une autorisation parentale de droit à l’image est requise avant toute publication. Vous pouvez resoumettre avec les autorisations ou une version floutée.', reviewedAt: new Date() },
      { type: 'VIDEO', title: 'Le théorème de Thalès — cours complet (3e)', description: 'Cours complet de géométrie pour la 3e.', cycleId: classByCode['3E'].cycleId, classLevelId: classByCode['3E'].id, disciplineId: disc['MATHS'], themeId: theme['SCIENCES'], chapter: 'Théorème de Thalès', keywords: ['Thalès'], language: 'FR', authorId: teacher.id, status: 'APPROVED', reviewerId: admin.id, reviewNote: 'Excellent travail, publié sur la chaîne officielle.', reviewedAt: new Date(), mediaId: mediaByKey['thales'] },
    ] });
  }

  console.log('→ Interactions (commentaires, likes, favoris, listes, historique, notifications, signalements)');
  const thales = mediaByKey['thales'];
  const fractions = mediaByKey['fractions-wolof'];
  const indep = mediaByKey['independance'];
  if ((await prisma.comment.count()) === 0) {
    const c1 = await prisma.comment.create({ data: { mediaId: thales, authorId: student.id, content: 'Merci monsieur, j’ai enfin compris la réciproque ! Est-ce qu’il y aura une vidéo sur Pythagore ?' } });
    await prisma.comment.create({ data: { mediaId: thales, authorId: teacher.id, parentId: c1.id, content: 'Bonjour Awa, oui, la capsule sur Pythagore est en préparation. Continue à t’entraîner avec les exercices des annales.' } });
    await prisma.comment.create({ data: { mediaId: thales, authorId: student2.id, content: 'Très clair. La partie sur les applications au BFEM est super utile.' } });
    await prisma.comment.create({ data: { mediaId: fractions, authorId: student4.id, content: 'Jërëjëf ! Mes petits frères ont tout compris.' } });
    await prisma.comment.create({ data: { mediaId: indep, authorId: student3.id, content: 'Vidéo très utile pour réviser le bac. Merci !' } });
    await prisma.comment.create({ data: { mediaId: indep, authorId: student2.id, content: 'contenu pas utile, achetez mes cours sur mon site xyz', status: 'HIDDEN', hiddenReason: 'Spam / publicité' } });
    await prisma.media.update({ where: { id: thales }, data: { commentCount: 3 } });
    await prisma.media.update({ where: { id: fractions }, data: { commentCount: 1 } });
    await prisma.media.update({ where: { id: indep }, data: { commentCount: 1 } });
  }
  await prisma.like.createMany({ data: [
    { userId: student.id, mediaId: thales }, { userId: student2.id, mediaId: thales }, { userId: teacher2.id, mediaId: thales },
    { userId: student4.id, mediaId: fractions }, { userId: student3.id, mediaId: indep }, { userId: student.id, mediaId: indep },
  ], skipDuplicates: true });
  for (const id of [thales, fractions, indep]) {
    const n = await prisma.like.count({ where: { mediaId: id } });
    await prisma.media.update({ where: { id }, data: { likeCount: n } });
  }
  await prisma.favorite.createMany({ data: [{ userId: student.id, mediaId: thales }, { userId: student.id, mediaId: fractions }, { userId: teacher.id, mediaId: indep }], skipDuplicates: true });

  if ((await prisma.playlist.count()) === 0) {
    const pl = await prisma.playlist.create({ data: { ownerId: teacher.id, title: 'Révisions BFEM — Mathématiques', description: 'Sélection pour mes élèves de 3e.', isPublic: true } });
    await prisma.playlistItem.createMany({ data: [{ playlistId: pl.id, mediaId: thales, position: 1 }] });
    const pl2 = await prisma.playlist.create({ data: { ownerId: student.id, title: 'À revoir avant l’examen', isPublic: false } });
    await prisma.playlistItem.createMany({ data: [{ playlistId: pl2.id, mediaId: thales, position: 1 }, { playlistId: pl2.id, mediaId: indep, position: 2 }] });
  }

  await prisma.watchHistory.upsert({ where: { userId_mediaId: { userId: student.id, mediaId: thales } }, update: {}, create: { userId: student.id, mediaId: thales, positionSec: 12, maxPositionSec: 12 } });
  await prisma.watchHistory.upsert({ where: { userId_mediaId: { userId: student.id, mediaId: indep } }, update: {}, create: { userId: student.id, mediaId: indep, positionSec: 30, maxPositionSec: 30, completed: true } });

  if ((await prisma.viewEvent.count()) === 0) {
    const events: { mediaId: string; userId: string | null; createdAt: Date }[] = [];
    const ids = Object.values(mediaByKey);
    const users = [student.id, student2.id, student3.id, student4.id, teacher.id, null];
    for (let day = 0; day < 30; day++) {
      for (let k = 0; k < 6 + Math.floor(Math.random() * 10); k++) {
        events.push({ mediaId: ids[Math.floor(Math.random() * ids.length)], userId: users[Math.floor(Math.random() * users.length)], createdAt: new Date(Date.now() - day * 86400000 - Math.random() * 86400000) });
      }
    }
    await prisma.viewEvent.createMany({ data: events });
  }

  if ((await prisma.notification.count()) === 0) {
    await prisma.notification.createMany({ data: [
      { userId: admin.id, type: 'SUBMISSION_RECEIVED', title: 'Nouvelle proposition : « Résolution d’équations du premier degré (4e) »', body: 'Proposée par Moussa Ndiaye (Lycée Blaise Diagne).', link: '/admin/moderation' },
      { userId: admin.id, type: 'SUBMISSION_RECEIVED', title: 'Nouvelle proposition : « Podcast élèves : Notre visite au Musée des Civilisations noires »', body: 'Proposée par Awa Faye (CEM de Thiès-Nord).', link: '/admin/moderation' },
      { userId: teacher.id, type: 'SUBMISSION_APPROVED', title: 'Votre proposition « Le théorème de Thalès » a été publiée', body: 'Excellent travail, publié sur la chaîne officielle.', link: '/catalogue' },
      { userId: teacher2.id, type: 'SUBMISSION_REJECTED', title: 'Votre proposition « Expérience : l’eau et ses trois états » n’a pas été retenue', body: 'Une autorisation parentale de droit à l’image est requise.', link: '/mon-espace/propositions' },
      { userId: student.id, type: 'RECOMMENDATION', title: 'M. Ndiaye vous recommande « Le théorème de Thalès — cours complet (3e) »', body: 'À regarder avant le contrôle de jeudi.', link: '/catalogue' },
    ] });
  }
  if ((await prisma.recommendation.count()) === 0) {
    await prisma.recommendation.createMany({ data: [
      { senderId: teacher.id, recipientId: student.id, mediaId: thales, message: 'À regarder avant le contrôle de jeudi.' },
      { senderId: teacher.id, classLevelId: classByCode['3E'].id, mediaId: thales, message: 'Diffusé à toute la classe de 3e.' },
    ] });
  }
  if ((await prisma.report.count()) === 0) {
    const hidden = await prisma.comment.findFirst({ where: { status: 'HIDDEN' } });
    await prisma.report.createMany({ data: [
      { reporterId: student3.id, targetType: 'COMMENT', targetId: hidden?.id ?? 'inconnu', reason: 'SPAM', details: 'Publicité pour un site externe.', status: 'RESOLVED', resolvedById: admin2.id, resolution: 'Commentaire masqué.', resolvedAt: new Date() },
      { reporterId: student2.id, targetType: 'MEDIA', targetId: fractions, reason: 'ERREUR_PEDAGOGIQUE', details: 'À 1:20, il me semble qu’il y a une inversion entre numérateur et dénominateur.', status: 'OPEN' },
    ] });
  }
  if ((await prisma.moderationDecision.count()) === 0) {
    await prisma.moderationDecision.createMany({ data: [
      { moderatorId: admin.id, targetType: 'SUBMISSION', targetId: 'seed', action: 'APPROVE', reason: 'Excellent travail, publié sur la chaîne officielle.' },
      { moderatorId: admin2.id, targetType: 'COMMENT', targetId: 'seed', action: 'HIDE', reason: 'Spam / publicité' },
      { moderatorId: admin.id, targetType: 'MEDIA', targetId: mediaByKey['ancien-programme'], action: 'ARCHIVE', reason: 'Remplacé par la version conforme au curriculum actualisé.' },
    ] });
  }

  console.log('→ Paramètres');
  for (const [key, value] of Object.entries({
    'quota.submission.maxPerWeek': '5',
    'quota.submission.maxMb': '500',
    'quota.comment.maxPerHour': '30',
    'moderation.commentsRequireApproval': 'false',
    'platform.announcement': '',
  })) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  await prisma.auditLog.create({ data: { actorId: admin.id, action: 'SEED_EXECUTED', details: { demoPassword: 'voir SEED_DEMO_PASSWORD' } } });

  console.log('\n✔ Seed terminé.');
  console.log('  Comptes : admin@education.sn (admin) · moderation@education.sn (admin) · enseignant@education.sn (enseignant) · eleve@education.sn (élève)');
  console.log(`  Mot de passe : ${DEMO_PASSWORD}`);
  console.log('  Les médias de démonstration seront publiés dès que le worker aura terminé le transcodage.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

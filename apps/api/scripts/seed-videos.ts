import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
const run = promisify(execFile);
if (process.env.NODE_ENV === 'production') {
  throw new Error('Ces vidéos sont réservées aux tests locaux.');
}
const directory = resolve(fileURLToPath(new URL('../../../', import.meta.url)), 'data/demo-videos');
await mkdir(directory, { recursive: true });
const names = ['demo-introduction.mp4', 'demo-suite.mp4', 'demo-fin.mp4'];
const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};
if (!(await exists(resolve(directory, names[0])))) {
  const archive = resolve(directory, 'big-buck-bunny.zip');
  if (!(await exists(archive))) {
    console.log('Téléchargement de Big Buck Bunny depuis la Fondation Blender…');
    await run(
      'curl',
      [
        '--fail',
        '--location',
        '--max-time',
        '180',
        'https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4.zip',
        '-o',
        archive,
      ],
      { timeout: 190000 },
    );
  }
  await run('unzip', ['-n', archive, '-d', directory]);
}
for (const [index, name] of names.entries()) {
  if (!(await exists(resolve(directory, name)))) {
    await run(
      process.env.FFMPEG_PATH ?? ffmpeg ?? 'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-ss',
        String([35, 120, 250][index]),
        '-i',
        resolve(directory, 'BigBuckBunny_320x180.mp4'),
        '-t',
        '24',
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        resolve(directory, name),
      ],
      { timeout: 60000 },
    );
  }
}
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3082';
const base = process.env.API_URL ?? 'http://127.0.0.1:3083/api/v1';
async function login(email: string) {
  const response = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: process.env.DEMO_PASSWORD ?? 'EduTube-Test2026!' }),
  });
  if (!response.ok) {
    throw new Error(
      'Créez les comptes avec make demo, puis vérifiez DEMO_PASSWORD si vous avez changé leur mot de passe.',
    );
  }
  const result = (await response.json()) as { data: { csrfToken: string } };
  return {
    Origin: origin,
    Cookie: response.headers.get('set-cookie')!.split(';')[0],
    'X-CSRF-Token': result.data.csrfToken,
  };
}
const headers = await login('enseignant@edutube.test');
async function request(path: string, method = 'GET', body?: unknown, form?: FormData) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...headers,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(form ? { 'Idempotency-Key': `demo-video-${path}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : form ? { body: form } : {}),
  });
  const result = (await response.json()) as { data: unknown; error?: { message: string } };
  if (!response.ok) {
    throw new Error(result.error?.message ?? `Demande refusée (${response.status}).`);
  }
  return result.data;
}
let courseId: string | undefined;
const pointer = resolve(directory, 'course.json');
if (await exists(pointer)) {
  courseId = (JSON.parse(await readFile(pointer, 'utf8')) as { id: string }).id;
  await request(`/teaching/courses/${courseId}`);
}
if (!courseId) {
  const taxonomy = (await request('/taxonomy')) as { subjects: { id: string; name: string }[] };
  const subject =
    taxonomy.subjects.find((item) => item.name === 'Numérique') ?? taxonomy.subjects[0];
  const created = (await request('/teaching/courses', 'POST', {
    title: 'Le cinéma comme terrain d’apprentissage',
    shortDescription:
      'Trois extraits pour tester le lecteur, la navigation et les chapitres protégés.',
    description:
      'Un atelier de démonstration du parcours vidéo EduTube. Les extraits ne sont pas des cours : ils servent uniquement à vérifier la lecture et la progression.',
    subjectId: subject.id,
    schoolLevel: 'SECONDARY',
    language: 'fr',
    palette: 'purple',
    illustration: 'code',
    outcomes: [
      'Utiliser les commandes du lecteur',
      'Passer au chapitre suivant',
      'Réussir un examen pour poursuivre',
    ],
    prerequisites: [],
    lessons: names.map((_name, index) => ({
      id: randomUUID(),
      title: [
        'Découvrir le lecteur vidéo',
        'Poursuivre après l’examen',
        'Aller au bout du parcours',
      ][index],
      kind: 'VIDEO',
      estimatedMinutes: 1,
      previewAllowed: index === 0,
      requiresQuiz: index === 1,
      blocks: [
        {
          type: 'PARAGRAPH',
          text: 'Extrait de Big Buck Bunny — © 2008 Blender Foundation, www.bigbuckbunny.org. Licence Creative Commons Attribution 3.0 : https://creativecommons.org/licenses/by/3.0/. Extrait raccourci pour tester EduTube.',
        },
      ],
    })),
    quiz: {
      title: 'Prêt à poursuivre ?',
      passingScore: 70,
      questions: [
        {
          id: randomUUID(),
          prompt: 'Quel bouton permet de poursuivre le cours ?',
          options: [
            { id: 'suivant', text: 'Suivant' },
            { id: 'quitter', text: 'Quitter le site' },
          ],
          correctOptionId: 'suivant',
          explanation: 'Le bouton Suivant ouvre le prochain chapitre accessible.',
        },
        {
          id: randomUUID(),
          prompt: 'Comment débloquer un chapitre protégé ?',
          options: [
            { id: 'reussir', text: 'Réussir l’examen avec le score demandé' },
            { id: 'changer', text: 'Changer l’adresse dans le navigateur' },
          ],
          correctOptionId: 'reussir',
          explanation: 'Le serveur vérifie la réussite de l’examen avant chaque accès.',
        },
      ],
    },
  })) as { id: string };
  courseId = created.id;
  await writeFile(pointer, JSON.stringify({ id: courseId }, null, 2) + '\n');
}
type Course = { id: string; revision: number; status: string; lessons: { id: string }[] };
let course = (await request(`/teaching/courses/${courseId}`)) as Course;
for (const [index, lesson] of course.lessons.entries()) {
  const path = `/teaching/courses/${courseId}/lessons/${lesson.id}/video`;
  let state = (await request(path)) as { video: { status: string } | null };
  if (!state.video) {
    const form = new FormData();
    form.set('expectedRevision', String(course.revision));
    form.set(
      'file',
      new Blob([await readFile(resolve(directory, names[index]))], { type: 'video/mp4' }),
      names[index],
    );
    state = (await request(path, 'POST', undefined, form)) as typeof state;
    course = (await request(`/teaching/courses/${courseId}`)) as Course;
  }
  const deadline = Date.now() + 180000;
  while (state.video?.status !== 'READY') {
    if (state.video?.status === 'FAILED' || Date.now() > deadline) {
      throw new Error('La vidéo n’est pas prête. Consultez son état dans l’espace enseignant.');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    state = (await request(path)) as typeof state;
  }
  console.log(`Chapitre ${index + 1} : vidéo prête.`);
}
if (course.status === 'DRAFT') {
  course = (await request(`/teaching/courses/${courseId}/status`, 'PUT', {
    expectedRevision: course.revision,
    status: 'PUBLISHED',
  })) as Course;
}
for (const email of ['eleve@edutube.test', 'nouveau@edutube.test']) {
  const learner = await login(email);
  const response = await fetch(base + '/me/enrollments', {
    method: 'POST',
    headers: {
      ...learner,
      'Content-Type': 'application/json',
      'Idempotency-Key': `demo-video-${courseId}`,
    },
    body: JSON.stringify({ courseId }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  await fetch(base + '/auth/logout', { method: 'POST', headers: learner });
}
await fetch(base + '/auth/logout', { method: 'POST', headers });
console.log(`Parcours de test prêt : ${origin}/cours/${courseId}`);

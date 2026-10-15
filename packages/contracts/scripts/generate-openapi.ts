import { writeFile } from 'node:fs/promises';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { operations } from '../src/operations';
import { apiErrorSchema } from '../src/index';
const activeOperations = new Set([
  'adminOverview',
  'adminAccounts',
  'adminCreateAccount',
  'adminChangeAccount',
  'adminCourses',
  'adminModerate',
  'adminJournal',
  'adminReview',
  'adminVideo',
  'adminVideoFile',
  'video',
  'videoFile',
  'teachingVideo',
  'uploadVideo',
  'removeVideo',
  'lessonAccess',
  'profile',
  'saveProfile',
  'requestVerification',
  'verifyEmail',
  'forgotPassword',
  'resetPassword',
  'resources',
  'download',
  'teachingResources',
  'uploadResource',
  'removeResource',
  'teachingCourses',
  'teachingCourse',
  'teachingCreate',
  'teachingSave',
  'teachingStatus',
  'taxonomy',
  'courses',
  'course',
  'paths',
  'path',
  'lesson',
  'session',
  'me',
  'login',
  'register',
  'logout',
  'quiz',
  'attempt',
  'dashboard',
  'enrollments',
  'enroll',
  'enrollPath',
  'progress',
  'complete',
  'pathProgress',
  'resume',
  'visit',
  'favorites',
  'saveFavorite',
  'deleteFavorite',
  'notes',
  'note',
  'saveNote',
  'attempts',
]);
const schemas: Record<string, unknown> = {};
const paths: Record<string, Record<string, unknown>> = {};
const json = (schema: Parameters<typeof zodToJsonSchema>[0]) =>
  zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' });
schemas.ApiError = json(apiErrorSchema);
for (const [name, operation] of Object.entries(operations)) {
  const parameters: unknown[] = [...operation.path.matchAll(/\{(\w+)\}/g)].map((match) => ({
    in: 'path',
    name: match[1],
    required: true,
    schema: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$' },
  }));
  if (operation.query) {
    const query = json(operation.query) as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    for (const [key, schema] of Object.entries(query.properties ?? {})) {
      parameters.push({
        in: 'query',
        name: key,
        required: query.required?.includes(key) ?? false,
        schema,
      });
    }
  }
  const responses: Record<string, unknown> = {};
  if (operation.status === 204) {
    responses['204'] = { description: 'Opération terminée, sans corps' };
  } else if (operation.binary) {
    responses[String(operation.status)] = {
      description: 'Fichier autorisé',
      content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
    };
  } else {
    schemas[`${name}Response`] = {
      type: 'object',
      properties: { data: json(operation.response) },
      required: ['data'],
      additionalProperties: false,
    };
    responses[String(operation.status)] = {
      description: 'Succès',
      content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}Response` } } },
    };
  }
  for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 429, 500]) {
    responses[String(status)] = {
      description: `Erreur HTTP ${status}`,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
    };
  }
  if (name === 'videoFile' || name === 'adminVideoFile') {
    parameters.push({
      in: 'header',
      name: 'Range',
      required: false,
      schema: { type: 'string' },
      description: 'Une seule plage d’octets : bytes=debut-fin ou bytes=-taille.',
    });
    responses['206'] = {
      description: 'Plage d’octets autorisée',
      headers: { 'Content-Range': { schema: { type: 'string' } } },
      content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
    };
    responses['416'] = {
      description: 'Plage impossible, corps vide',
      headers: { 'Content-Range': { schema: { type: 'string' } } },
    };
  }
  let requestBody: unknown;
  if (operation.body) {
    const inputSchema = json(operation.body) as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    schemas[`${name}Input`] = operation.multipart
      ? {
          ...inputSchema,
          properties: {
            ...inputSchema.properties,
            file: {
              type: 'string',
              format: 'binary',
              description:
                name === 'uploadVideo' ? 'MP4, maximum 1 Go' : 'PDF ou TXT, maximum 10 Mo',
            },
          },
          required: [...(inputSchema.required ?? []), 'file'],
        }
      : inputSchema;
    requestBody = {
      required: true,
      content: {
        [operation.multipart ? 'multipart/form-data' : 'application/json']: {
          schema: { $ref: `#/components/schemas/${name}Input` },
        },
      },
    };
  }
  if (operation.authenticated && ['POST', 'PUT', 'DELETE'].includes(operation.method)) {
    parameters.push({
      in: 'header',
      name: 'X-CSRF-Token',
      required: true,
      schema: { type: 'string' },
    });
  }
  if (
    name === 'uploadVideo' ||
    name === 'uploadResource' ||
    name === 'attempt' ||
    name === 'enroll' ||
    name === 'enrollPath'
  ) {
    parameters.push({
      in: 'header',
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string' },
    });
  }
  paths[operation.path] ??= {};
  paths[operation.path][operation.method.toLowerCase()] = {
    operationId: name,
    'x-implementation-status': activeOperations.has(name) ? 'implemented' : 'planned',
    summary: operation.summary,
    parameters,
    responses,
    security: operation.authenticated ? [{ sessionCookie: [] }] : [],
    ...(requestBody ? { requestBody } : {}),
  };
}
const document = {
  openapi: '3.0.3',
  info: {
    title: 'EduTube — contrat du serveur Node',
    version: '1.0.0',
    description:
      'Catalogue, comptes, apprentissage, espace enseignant et documents de fichiers réalisés.',
  },
  servers: [{ url: '/api/v1' }],
  paths,
  components: {
    securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'edutube_session' } },
    schemas,
  },
};
await writeFile(
  new URL('../../../docs/openapi.json', import.meta.url),
  JSON.stringify(document, null, 2) + '\n',
);
console.log(`${Object.keys(operations).length} opérations documentées dans docs/openapi.json`);

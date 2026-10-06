import { prisma } from '@/lib/db';
import { handler, ok, noContent, parseJson, badRequest, ApiError } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { taxonomySchema } from '@/lib/validation';
import { audit } from '@/lib/audit';

// PATCH /api/v1/admin/taxonomy/:kind/:id
export const PATCH = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const data = await parseJson(req, taxonomySchema.partial());
  let row;
  switch (params.kind) {
    case 'cycles': row = await prisma.cycle.update({ where: { id: params.id }, data: { code: data.code, name: data.name, order: data.order } }); break;
    case 'classes': row = await prisma.classLevel.update({ where: { id: params.id }, data: { code: data.code, name: data.name, order: data.order, cycleId: data.cycleId } }); break;
    case 'disciplines': row = await prisma.discipline.update({ where: { id: params.id }, data: { code: data.code, name: data.name, color: data.color } }); break;
    case 'themes': row = await prisma.theme.update({ where: { id: params.id }, data: { code: data.code, name: data.name, description: data.description } }); break;
    default: throw badRequest('Type de référentiel inconnu.');
  }
  await audit({ actorId: admin.id, action: 'TAXONOMY_UPDATE', entity: params.kind, entityId: params.id });
  return ok(row);
});

// DELETE /api/v1/admin/taxonomy/:kind/:id — refusé si des contenus y sont rattachés
export const DELETE = handler(async (_req, { params }) => {
  const admin = await requireRole('ADMIN');
  const counts = {
    cycles: () => prisma.media.count({ where: { cycleId: params.id } }),
    classes: () => prisma.media.count({ where: { classLevelId: params.id } }),
    disciplines: () => prisma.media.count({ where: { disciplineId: params.id } }),
    themes: () => prisma.media.count({ where: { themeId: params.id } }),
  } as const;
  const kind = params.kind as keyof typeof counts;
  if (!counts[kind]) throw badRequest('Type de référentiel inconnu.');
  if ((await counts[kind]()) > 0) throw new ApiError(409, 'Impossible de supprimer : des contenus sont rattachés à cet élément.', 'CONFLIT');
  switch (kind) {
    case 'cycles': await prisma.cycle.delete({ where: { id: params.id } }); break;
    case 'classes': await prisma.classLevel.delete({ where: { id: params.id } }); break;
    case 'disciplines': await prisma.discipline.delete({ where: { id: params.id } }); break;
    case 'themes': await prisma.theme.delete({ where: { id: params.id } }); break;
  }
  await audit({ actorId: admin.id, action: 'TAXONOMY_DELETE', entity: kind, entityId: params.id });
  return noContent();
});

import { prisma } from '@/lib/db';
import { handler, created, parseJson, badRequest } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { taxonomySchema } from '@/lib/validation';
import { audit } from '@/lib/audit';

// POST /api/v1/admin/taxonomy/:kind — kind ∈ cycles | classes | disciplines | themes
export const POST = handler(async (req, { params }) => {
  const admin = await requireRole('ADMIN');
  const data = await parseJson(req, taxonomySchema);
  let row;
  switch (params.kind) {
    case 'cycles': row = await prisma.cycle.create({ data: { code: data.code, name: data.name, order: data.order ?? 99 } }); break;
    case 'classes':
      if (!data.cycleId) throw badRequest('cycleId requis pour une classe.');
      row = await prisma.classLevel.create({ data: { code: data.code, name: data.name, order: data.order ?? 99, cycleId: data.cycleId } }); break;
    case 'disciplines': row = await prisma.discipline.create({ data: { code: data.code, name: data.name, color: data.color ?? '#0099CC' } }); break;
    case 'themes': row = await prisma.theme.create({ data: { code: data.code, name: data.name, description: data.description ?? null } }); break;
    default: throw badRequest('Type de référentiel inconnu.');
  }
  await audit({ actorId: admin.id, action: 'TAXONOMY_CREATE', entity: params.kind, entityId: row.id, details: { code: data.code } });
  return created(row);
});

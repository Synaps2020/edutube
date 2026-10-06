import { prisma } from '@/lib/db';
import { handler, ok, created, parseQuery, parseJson, ApiError } from '@/lib/api';
import { requireRole, hashPassword, toSafeUser } from '@/lib/auth';
import { adminCreateUserSchema } from '@/lib/validation';
import { audit } from '@/lib/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/users?q=&role=&statut=&page=
export const GET = handler(async (req) => {
  await requireRole('ADMIN');
  const q = parseQuery(req, z.object({ q: z.string().optional(), role: z.enum(['ADMIN', 'TEACHER', 'STUDENT']).optional(), statut: z.enum(['ACTIVE', 'SUSPENDED']).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) }));
  const where = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.statut ? { status: q.statut } : {}),
    ...(q.q ? { OR: [{ firstName: { contains: q.q, mode: 'insensitive' as const } }, { lastName: { contains: q.q, mode: 'insensitive' as const } }, { email: { contains: q.q, mode: 'insensitive' as const } }, { establishment: { contains: q.q, mode: 'insensitive' as const } }] } : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, include: { classLevel: { select: { code: true, name: true } }, _count: { select: { submissions: true, comments: true } } }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return ok({ items: users.map((u) => ({ ...toSafeUser(u), classLevel: u.classLevel, _count: u._count })), meta: { page: q.page, pageSize: q.pageSize, total } });
});

// POST /api/v1/admin/users — créer un compte (tout rôle, y compris administrateur)
export const POST = handler(async (req) => {
  const admin = await requireRole('ADMIN');
  const data = await parseJson(req, adminCreateUserSchema);
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new ApiError(409, 'Un compte existe déjà avec cette adresse.', 'CONFLIT');
  const user = await prisma.user.create({ data: { email: data.email, passwordHash: await hashPassword(data.password), firstName: data.firstName, lastName: data.lastName, role: data.role, classLevelId: data.classLevelId ?? null, establishment: data.establishment ?? null, region: data.region ?? null, ief: data.ief ?? null, ia: data.ia ?? null } });
  await audit({ actorId: admin.id, action: 'USER_CREATE', entity: 'User', entityId: user.id, details: { role: user.role, email: user.email } });
  return created(toSafeUser(user));
});

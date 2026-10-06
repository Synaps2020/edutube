import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/users/search?q= — recherche d'un destinataire (nom ou e-mail) pour une recommandation.
// Ne renvoie que des informations minimales.
export const GET = handler(async (req) => {
  const me = await requireUser();
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return ok([]);
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE', id: { not: me.id },
      OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }],
    },
    select: { id: true, firstName: true, lastName: true, role: true, establishment: true, classLevel: { select: { code: true } } },
    take: 8,
    orderBy: { lastName: 'asc' },
  });
  return ok(users);
});
